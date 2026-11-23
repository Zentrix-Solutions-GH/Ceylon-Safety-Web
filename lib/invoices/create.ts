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
  // Idempotency: return ok:true if invoice already exists.
  const { data: existing } = await sb
    .from("invoices")
    .select("id")
    .eq("order_id", orderId)
    .maybeSingle();

  if (existing) return { ok: true };

  // Load order.
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

  // Load order items.
  const { data: items, error: itemsError } = await sb
    .from("order_items")
    .select("document_id, title_snapshot, language, unit_price_cents")
    .eq("order_id", orderId);

  if (itemsError || !items) {
    console.error("ensureInvoice: failed to load order_items", { orderId, error: safeErrorMessage(itemsError) });
    return { ok: false };
  }

  // Load seller snapshot and contact email from business settings.
  const settings = await getInvoiceSettings(sb);
  if (!settings) return { ok: false };

  // Get invoice number via private RPC.
  const { data: invoiceNumber, error: rpcError } = await sb.rpc("next_invoice_number" as never);
  if (rpcError || !invoiceNumber) {
    console.error("ensureInvoice: next_invoice_number rpc failed", { orderId, error: safeErrorMessage(rpcError) });
    return { ok: false };
  }

  const issuedAt = new Date().toISOString();
  const pdfKey = `invoices/${orderId}.pdf`;

  const invoiceData = {
    invoice_number: invoiceNumber as string,
    issued_at: issuedAt,
    seller_snapshot: settings.seller,
    support_email: settings.contactEmail,
    tax_label: null,
    tax_rate_bps: null,
    tax_cents: 0,
  };

  // Build PDF.
  const mappedItems = items.map((i) => ({
    document_id: i.document_id ?? "",
    title_en: i.title_snapshot,
    language: i.language ?? "en",
    unit_price_cents: i.unit_price_cents,
  }));

  const pdfBytes = await buildInvoicePdf(order, mappedItems, invoiceData);

  // INSERT first — unique constraint on order_id serialises concurrent runs (AC6).
  // If two runs race, the second hits 23505 and returns ok:true without overwriting R2.
  // If R2 upload fails after a successful INSERT, regenerateInvoice will re-upload.
  const { error: insertError } = await sb
    .from("invoices")
    .insert({
      order_id: orderId,
      invoice_number: invoiceData.invoice_number,
      issued_at: invoiceData.issued_at,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      seller_snapshot: invoiceData.seller_snapshot as any, // SellerSnapshot not assignable to Json
      tax_label: null,
      tax_rate_bps: null,
      tax_cents: 0,
      pdf_key: pdfKey,
    })
    .select("id")
    .single();

  if (insertError) {
    // 23505 = unique_violation: a concurrent run already inserted this invoice.
    if ((insertError as { code?: string }).code === "23505") return { ok: true };
    console.error("ensureInvoice: insert failed", { orderId, error: safeErrorMessage(insertError) });
    return { ok: false };
  }

  // INSERT succeeded — now upload the PDF whose invoice_number matches the DB row.
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
