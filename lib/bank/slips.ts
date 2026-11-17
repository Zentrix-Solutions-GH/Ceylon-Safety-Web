import "server-only";

import { z } from "zod";

import { requireActiveAccount } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { putObject, deleteObject } from "@/lib/r2/storage";
import { checkRateLimit } from "@/lib/ratelimit";
import { validateSlipFile } from "@/lib/bank/validate";
import { r2Config, SLIP_MAX_BYTES } from "@/lib/config";
import type { ActionResult } from "@/types/api";
import type { BankOrderView, SlipSummary } from "@/types/bank-slip";

const SLIP_UPLOAD_LIMIT = 10;
const SLIP_UPLOAD_WINDOW_SECONDS = 3600;

// ─── uploadBankSlip ──────────────────────────────────────────────────────────

export async function uploadBankSlip(
  orderId: string,
  formData: FormData,
): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(orderId).success) {
    return { ok: false, code: "validation_failed" };
  }

  const authResult = await requireActiveAccount();
  if (!authResult.ok) return { ok: false, code: "not_allowed" };
  const { user } = authResult;

  const supabase = await createSupabaseServerClient();

  // Verify order ownership and eligibility (AC1).
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, user_id, status, payment_provider")
    .eq("id", orderId)
    .single();

  if (orderError || !order) return { ok: false, code: "not_found" };
  if (order.user_id !== user.id) return { ok: false, code: "not_found" };
  if (order.payment_provider !== "bank_transfer") return { ok: false, code: "not_found" };
  if (order.status !== "pending_verification") return { ok: false, code: "not_allowed" };

  // Rate limit per order (AC5): 10 uploads per hour.
  const rlResult = await checkRateLimit({
    limitName: "slip_upload",
    key: `order:${orderId}`,
    maxCount: SLIP_UPLOAD_LIMIT,
    windowSeconds: SLIP_UPLOAD_WINDOW_SECONDS,
    mode: "closed",
  });
  if (!rlResult.ok) return { ok: false, code: "rate_limited" };

  // Extract file from FormData.
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, code: "validation_failed" };

  // Validate file content type and size (AC2).
  const validateResult = await validateSlipFile(file, SLIP_MAX_BYTES);
  if (!validateResult.ok) return validateResult;
  const { mimeType, sizeBytes, bytes } = validateResult.data!;

  // Generate server-controlled key (AC3) — the original filename is discarded.
  const ext = mimeType === "application/pdf" ? "pdf" : mimeType === "image/png" ? "png" : "jpg";
  const slipId = crypto.randomUUID();
  const cfg = r2Config();
  if (!cfg) return { ok: false, code: "unknown" };
  const key = `slips/${orderId}/${slipId}.${ext}`;

  // Upload to private bucket (AC3). If this fails, nothing was written — no cleanup needed.
  try {
    await putObject(cfg.bucketPrivate, key, bytes, mimeType);
  } catch {
    return { ok: false, code: "upload_failed" };
  }

  // Insert DB row (AC3). On failure, clean up the R2 object (AC8).
  const { error: insertError } = await supabase.from("bank_transfer_slips").insert({
    id: slipId,
    order_id: orderId,
    uploaded_by: user.id,
    file_key: key,
    mime_type: mimeType,
    size_bytes: sizeBytes,
    status: "uploaded",
  });

  if (insertError) {
    // AC8: orphan R2 object — delete it before returning the error.
    try { await deleteObject(cfg.bucketPrivate, key); } catch { /* best effort */ }
    return { ok: false, code: "unknown" };
  }

  return { ok: true };
}

// ─── getBankOrderView ────────────────────────────────────────────────────────

export async function getBankOrderView(orderId: string): Promise<ActionResult<BankOrderView>> {
  if (!z.string().uuid().safeParse(orderId).success) {
    return { ok: false, code: "validation_failed" };
  }

  const authResult = await requireActiveAccount();
  if (!authResult.ok) return { ok: false, code: "not_allowed" };
  const { user } = authResult;

  const supabase = await createSupabaseServerClient();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, user_id, order_number, status, payment_provider")
    .eq("id", orderId)
    .single();

  if (orderError || !order) return { ok: false, code: "not_found" };
  if (order.user_id !== user.id) return { ok: false, code: "not_found" };
  if (order.payment_provider !== "bank_transfer") return { ok: false, code: "not_found" };

  // Bank details from site_settings (AC6 — never hardcoded).
  const { data: settingRow } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "bank_account_details")
    .single();

  const bankDetails = settingRow?.value ? String(settingRow.value) : "";

  // Slip rows via buyer_slip_summary view — file_key is structurally absent (AC6).
  const { data: slipRows } = await supabase
    .from("buyer_slip_summary")
    .select("status, uploaded_at, rejection_reason")
    .eq("order_id", orderId)
    .order("uploaded_at", { ascending: false });

  const slips: SlipSummary[] = (slipRows ?? []).map((r) => ({
    status: r.status as SlipSummary["status"],
    uploadedAt: r.uploaded_at,
    rejectionReason: r.rejection_reason ?? null,
  }));

  return {
    ok: true,
    data: {
      orderId: order.id,
      orderNumber: order.order_number,
      status: order.status,
      bankDetails,
      slips,
    },
  };
}
