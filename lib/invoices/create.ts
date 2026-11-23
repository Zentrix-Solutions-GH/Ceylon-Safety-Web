import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { buildInvoicePdf } from "./pdf";
import { r2Config } from "@/lib/config";
import { putObject } from "@/lib/r2/storage";
import { safeErrorMessage } from "@/lib/errors";
import type { SellerSnapshot } from "@/types/invoice";

type SB = SupabaseClient<Database>;

const SETTINGS_KEYS = ["business_legal_name", "business_address", "contact_email"] as const;

type InvoiceSettings = { seller: SellerSnapshot; contactEmail: string | null };

async function getInvoiceSettings(sb: SB): Promise<InvoiceSettings | null> {
  const { data, error } = await sb
    .from("site_settings")
    .select("key, value")
    .in("key", [...SETTINGS_KEYS]);

  if (error) return null;

  const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
  const name = map["business_legal_name"];
  const address = map["business_address"];

  if (!name || !address || typeof name !== "string" || typeof address !== "string") {
    console.warn("ensureInvoice: business_legal_name or business_address is not configured");
    return null;
  }

  const contactEmail = map["contact_email"];
  return { seller: { name, address }, contactEmail: typeof contactEmail === "string" ? contactEmail : null };
}

export async function ensureInvoice(
  orderId: string,
  sb: SB,
): Promise<{ ok: boolean }> {
  // Idempotency: return ok:true if invoice row exists AND PDF was successfully uploaded.
  // If the row exists but pdf_key is null, a previous run inserted the row but failed
  // before the R2 upload — fall through to retry the upload.
  const { data: existing } = await sb
    .from("invoices")
    .select("id, pdf_key, invoice_number, issued_at")
    .eq("order_id", orderId)
    .maybeSingle();

  if (existing?.pdf_key) return { ok: true };

  // Load order and items — needed regardless of whether this is a fresh create or a retry upload.
  const { data: orderRaw, error: orderError } = await sb
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (orderError || !orderRaw) {
    console.error("ensureInvoice: order not found", { orderId, error: safeErrorMessage(orderError) });
    return { ok: false };
  }
  const order = orderRaw as unknown as Parameters<typeof buildInvoicePdf>[0];

  const { data: items, error: itemsError } = await sb
    .from("order_items")
    .select("document_id, title_snapshot, language, unit_price_cents")
    .eq("order_id", orderId);

  if (itemsError || !items) {
    console.error("ensureInvoice: failed to load order_items", { orderId, error: safeErrorMessage(itemsError) });
    return { ok: false };
  }

  const settings = await getInvoiceSettings(sb);
  if (!settings) return { ok: false };

  const pdfKey = `invoices/${orderId}.pdf`;

  let invoiceNumber: string;
  let issuedAt: string;

  if (existing) {
    // Row exists but pdf_key is null: re-use the stored invoice_number and issued_at.
    // Do NOT call next_invoice_number() — that would create a gap in the sequence.
    invoiceNumber = existing.invoice_number;
    issuedAt = existing.issued_at;
  } else {
    // Fresh create: get a new invoice number from the private schema sequence.
    // private.next_invoice_number() is SECURITY DEFINER and callable by service_role.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: num, error: rpcError } = await (sb as any).rpc("next_invoice_number");
    if (rpcError || !num) {
      console.error("ensureInvoice: next_invoice_number rpc failed", { orderId, error: safeErrorMessage(rpcError) });
      return { ok: false };
    }
    invoiceNumber = num as string;
    issuedAt = new Date().toISOString();
  }

  const invoiceData = {
    invoice_number: invoiceNumber,
    issued_at: issuedAt,
    seller_snapshot: settings.seller,
    support_email: settings.contactEmail,
    tax_label: null,
    tax_rate_bps: null,
    tax_cents: 0,
  };

  const mappedItems = items.map((i) => ({
    document_id: i.document_id ?? "",
    title_en: i.title_snapshot,
    language: i.language ?? "en",
    unit_price_cents: i.unit_price_cents,
  }));

  const pdfBytes = await buildInvoicePdf(order, mappedItems, invoiceData);

  if (!existing) {
    // Two-phase write: INSERT without pdf_key so a concurrent second caller sees
    // the row (unique constraint) and returns ok:true, while we still upload the PDF.
    // On the next finalize retry, pdf_key IS NULL triggers the upload path above.
    const { error: insertError } = await sb
      .from("invoices")
      .insert({
        order_id: orderId,
        invoice_number: invoiceData.invoice_number,
        issued_at: invoiceData.issued_at,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        seller_snapshot: invoiceData.seller_snapshot as any,
        tax_label: null,
        tax_rate_bps: null,
        tax_cents: 0,
        pdf_key: null, // set after R2 upload succeeds
      });

    if (insertError) {
      // 23505 = unique_violation: a concurrent run already inserted this invoice.
      if ((insertError as { code?: string }).code === "23505") return { ok: true };
      console.error("ensureInvoice: insert failed", { orderId, error: safeErrorMessage(insertError) });
      return { ok: false };
    }
  }

  // Upload PDF to R2 (idempotent — safe to retry).
  const cfg = r2Config();
  if (!cfg) {
    console.error("ensureInvoice: R2 not configured");
    return { ok: false };
  }
  try {
    await putObject(cfg.bucketPrivate, pdfKey, pdfBytes, "application/pdf");
  } catch (err) {
    console.error("ensureInvoice: R2 upload failed", { orderId, error: safeErrorMessage(err) });
    return { ok: false };
  }

  // Phase 2: set pdf_key now that the R2 object exists.
  const { error: updateError } = await sb
    .from("invoices")
    .update({ pdf_key: pdfKey })
    .eq("order_id", orderId);

  if (updateError) {
    // PDF is in R2 but pdf_key not updated — next retry re-uploads (idempotent)
    // then sets pdf_key. Return ok:false so finalize retries.
    console.error("ensureInvoice: failed to set pdf_key", { orderId, error: safeErrorMessage(updateError) });
    return { ok: false };
  }

  return { ok: true };
}

export async function regenerateInvoice(
  orderId: string,
  sb: SB,
): Promise<{ ok: boolean }> {
  // Load existing invoice row (must already exist).
  const { data: invoice, error: invError } = await sb
    .from("invoices")
    .select("id, invoice_number, issued_at, seller_snapshot, tax_label, tax_rate_bps, tax_cents, pdf_key, order_id")
    .eq("order_id", orderId)
    .single();

  if (invError || !invoice) {
    console.error("regenerateInvoice: invoice row not found", { orderId });
    return { ok: false };
  }

  // Load order and items.
  const { data: orderRaw2, error: orderError } = await sb
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (orderError || !orderRaw2) return { ok: false };
  const order2 = orderRaw2 as unknown as Parameters<typeof buildInvoicePdf>[0];

  const { data: items } = await sb
    .from("order_items")
    .select("document_id, title_snapshot, language, unit_price_cents")
    .eq("order_id", orderId);

  if (!items) return { ok: false };

  const mappedItems = items.map((i) => ({
    document_id: i.document_id ?? "",
    title_en: i.title_snapshot,
    language: i.language ?? "en",
    unit_price_cents: i.unit_price_cents,
  }));

  // Fetch current contact_email (not frozen — footer shows current contact).
  const { data: emailRows } = await sb
    .from("site_settings")
    .select("key, value")
    .in("key", ["contact_email"]);
  const emailMap = Object.fromEntries((emailRows ?? []).map((r) => [r.key, r.value]));
  const contactEmail = typeof emailMap["contact_email"] === "string" ? emailMap["contact_email"] : null;

  // Use the FROZEN seller_snapshot from the invoice row (AC5).
  const invoiceData = {
    invoice_number: invoice.invoice_number,
    issued_at: invoice.issued_at,
    seller_snapshot: invoice.seller_snapshot as unknown as SellerSnapshot,
    support_email: contactEmail,
    tax_label: invoice.tax_label,
    tax_rate_bps: invoice.tax_rate_bps,
    tax_cents: invoice.tax_cents,
  };

  const pdfBytes = await buildInvoicePdf(order2, mappedItems, invoiceData);

  const cfg = r2Config();
  if (!cfg) {
    console.error("regenerateInvoice: R2 not configured");
    return { ok: false };
  }
  const pdfKey = invoice.pdf_key ?? `invoices/${orderId}.pdf`;
  try {
    await putObject(cfg.bucketPrivate, pdfKey, pdfBytes, "application/pdf");
  } catch (err) {
    console.error("regenerateInvoice: R2 upload failed", { orderId, error: safeErrorMessage(err) });
    return { ok: false };
  }

  return { ok: true };
}
