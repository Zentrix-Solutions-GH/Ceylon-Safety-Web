"use server";
import "server-only";

import { z } from "zod";
import { requireStaff } from "@/lib/auth/server";
import { requireStepUp } from "@/lib/auth/step-up";
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/ratelimit";
import { isSelfApproval, fetchApprovalDownloadLimit } from "@/lib/bank/review";
import type { ActionResult } from "@/types/api";
import type { BankQueueItem, BankQueueResult } from "@/types/bank-slip";

const PERMISSION = "bank_transfers.review";
const SECOND_APPROVAL_THRESHOLD_CENTS = 2_500_000; // LKR 25,000

// 10 per minute per actor, closed mode (AC12).
function checkBankActionLimit(actorId: string) {
  return checkRateLimit({
    limitName: "bank-action",
    key: actorId,
    maxCount: 10,
    windowSeconds: 60,
    mode: "closed",
  });
}

// ─── getBankTransferQueue (AC1) ───────────────────────────────────────────────

export async function getBankTransferQueue(): Promise<ActionResult<BankQueueResult>> {
  const auth = await requireStaff(PERMISSION);
  if (!auth.ok) return { ok: false, code: "not_allowed" };

  // The view is staff-only (SELECT revoked from authenticated in migration 002).
  // Must use the service-role client; the user-scoped client returns zero rows.
  const sbService = await createSupabaseServiceRoleClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rows, error } = await (sbService as any)
    .from("bank_transfer_queue")
    .select(
      "order_id, order_number, created_at, total_cents, buyer_name, " +
      "latest_slip_id, latest_slip_uploaded_at, awaiting_second_approval"
    )
    .order("created_at", { ascending: true })
    .then((r: { data: unknown; error: unknown }) => r);

  if (error) return { ok: false, code: "unknown" };

  const items: BankQueueItem[] = ((rows as Array<Record<string, unknown>>) ?? []).map((r) => ({
    orderId: String(r["order_id"] ?? ""),
    orderNumber: String(r["order_number"] ?? ""),
    createdAt: String(r["created_at"] ?? ""),
    amountCents: Number(r["total_cents"] ?? 0),
    buyerName: String(r["buyer_name"] ?? ""),
    latestSlipId: String(r["latest_slip_id"] ?? ""),
    latestSlipUploadedAt: String(r["latest_slip_uploaded_at"] ?? ""),
    awaitingSecondApproval: Boolean(r["awaiting_second_approval"]),
  }));

  const pending = items.filter((i) => !i.awaitingSecondApproval);
  const secondApproval = items.filter((i) => i.awaitingSecondApproval);

  return { ok: true, data: { pending, secondApproval } };
}

// ─── approveBankOrder (AC3–AC7) ───────────────────────────────────────────────

export async function approveBankOrder(
  orderId: string,
  slipId: string,
  code: string | undefined,
): Promise<ActionResult<{ outcome: string }>> {
  if (!z.string().uuid().safeParse(orderId).success) return { ok: false, code: "validation_failed" };
  if (!z.string().uuid().safeParse(slipId).success)  return { ok: false, code: "validation_failed" };

  const auth = await requireStaff(PERMISSION);
  if (!auth.ok) return { ok: false, code: "not_allowed" };
  const actor = auth.user;

  const rl = await checkBankActionLimit(actor.id);
  if (!rl.ok) return { ok: false, code: "rate_limited" };

  // AC3: step-up MFA
  try {
    await requireStepUp(actor.id, code);
  } catch (err) {
    const e = err as { code?: string };
    if (e.code === "mfa_required") return { ok: false, code: "mfa_required" };
    throw err;
  }

  const sb = await createSupabaseServerClient();
  const sbService = await createSupabaseServiceRoleClient();

  // Fetch order and buyer profile for self-approval check (AC4).
  const { data: order, error: orderErr } = await sb
    .from("orders")
    .select("id, user_id, status, total_cents, payment_provider, profiles(email, phone)")
    .eq("id", orderId)
    .single();

  if (orderErr || !order) return { ok: false, code: "not_found" };
  if (order.payment_provider !== "bank_transfer") return { ok: false, code: "not_found" };

  // Fetch slip.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: slip, error: slipErr } = await (sb as any)
    .from("bank_transfer_slips")
    .select("id, order_id, status, file_key, first_reviewed_by")
    .eq("id", slipId)
    .single() as { data: { id: string; order_id: string; status: string; file_key: string; first_reviewed_by: string | null } | null; error: unknown };

  if (slipErr || !slip) return { ok: false, code: "not_found" };
  if (slip.order_id !== orderId) return { ok: false, code: "not_found" };

  // AC4: self-approval check.
  const buyer = Array.isArray(order.profiles) ? order.profiles[0] : order.profiles;
  if (
    isSelfApproval(
      { user_id: order.user_id },
      buyer as { email: string | null; phone: string | null } | null,
      { id: actor.id, email: actor.email, phone: (actor as { phone?: string | null }).phone ?? null }
    )
  ) {
    return { ok: false, code: "not_allowed" };
  }

  // AC5: same-account second approval check (also caught by SQL, but fail fast here).
  if (slip.status === "awaiting_second_approval" && slip.first_reviewed_by === actor.id) {
    return { ok: false, code: "not_allowed" };
  }

  const downloadLimit = await fetchApprovalDownloadLimit(sb);

  // Call the locked SQL function (single atomic transaction).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rpcData, error: rpcErr } = await (sbService as any).rpc(
    "approve_bank_transfer_locked",
    {
      p_order_id:        orderId,
      p_slip_id:         slipId,
      p_actor_id:        actor.id,
      p_download_limit:  downloadLimit,
      p_threshold_cents: SECOND_APPROVAL_THRESHOLD_CENTS,
    }
  );

  if (rpcErr) return { ok: false, code: "unknown" };

  const outcome = (rpcData as { outcome?: string } | null)?.outcome;

  if (outcome === "already_done") {
    return { ok: false, code: "validation_failed", reason: "already_done" } as ActionResult<{ outcome: string }>;
  }
  if (outcome === "self_second_approval") {
    return { ok: false, code: "not_allowed" };
  }
  if (!outcome || outcome === "not_found") {
    return { ok: false, code: "not_found" };
  }

  return { ok: true, data: { outcome } };
}

// ─── rejectBankOrder (AC8) ────────────────────────────────────────────────────

export async function rejectBankOrder(
  orderId: string,
  slipId: string,
  reason: string,
  code: string | undefined,
): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(orderId).success) return { ok: false, code: "validation_failed" };
  if (!z.string().uuid().safeParse(slipId).success)  return { ok: false, code: "validation_failed" };
  if (!reason || reason.trim().length === 0)          return { ok: false, code: "validation_failed" };

  const auth = await requireStaff(PERMISSION);
  if (!auth.ok) return { ok: false, code: "not_allowed" };
  const actor = auth.user;

  const rl = await checkBankActionLimit(actor.id);
  if (!rl.ok) return { ok: false, code: "rate_limited" };

  try {
    await requireStepUp(actor.id, code);
  } catch (err) {
    const e = err as { code?: string };
    if (e.code === "mfa_required") return { ok: false, code: "mfa_required" };
    throw err;
  }

  const sb = await createSupabaseServerClient();
  const sbService = await createSupabaseServiceRoleClient();

  // Verify slip belongs to order.
  const { data: slip } = await sb
    .from("bank_transfer_slips")
    .select("id, order_id, status")
    .eq("id", slipId)
    .single();

  if (!slip || slip.order_id !== orderId)                          return { ok: false, code: "not_found" };
  if (slip.status === "accepted" || slip.status === "rejected")   return { ok: false, code: "validation_failed", reason: "already_done" };

  // Fetch buyer email for the notification queue.
  const { data: order } = await sb
    .from("orders")
    .select("id, user_id, payment_provider, profiles(email)")
    .eq("id", orderId)
    .single();

  if (!order || order.payment_provider !== "bank_transfer") return { ok: false, code: "not_found" };

  const now = new Date().toISOString();

  // Update slip: rejected — only if still in a rejectable status (atomic guard).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: slipUpdateErr, count: slipUpdateCount } = await (sbService as any)
    .from("bank_transfer_slips")
    .update({
      status:           "rejected",
      reviewed_by:      actor.id,
      reviewed_at:      now,
      rejection_reason: reason.trim(),
    })
    .eq("id", slipId)
    .in("status", ["uploaded", "awaiting_second_approval"]) as { error: unknown; count: number | null };

  if (slipUpdateErr) return { ok: false, code: "unknown" };
  if (slipUpdateCount === 0) return { ok: false, code: "validation_failed", reason: "already_done" };

  // Write audit row (best-effort; slip is already rejected so we do not fail the caller).
  const { error: auditErr } = await sbService
    .from("admin_audit_log")
    .insert({
      actor_id:    actor.id,
      action:      "bank_transfer.reject",
      entity_type: "bank_transfer_slip",
      entity_id:   slipId,
    });

  if (auditErr) {
    console.error("[rejectBankOrder] audit insert failed", { slip_id: slipId, msg: auditErr.message });
  }

  // Queue rejection email (AC13).
  const buyerEmail = Array.isArray(order.profiles)
    ? order.profiles[0]?.email
    : (order.profiles as { email?: string | null } | null)?.email;

  if (buyerEmail) {
    await sbService.from("email_logs").insert({
      to_email:     buyerEmail,
      template:     "bank_rejected",
      related_type: "bank_transfer_slip",
      related_id:   slipId,
      status:       "queued",
    });
  }

  return { ok: true };
}

// ─── rejectAndCancelBankOrder (AC9) ──────────────────────────────────────────

export async function rejectAndCancelBankOrder(
  orderId: string,
  reason: string,
  code: string | undefined,
): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(orderId).success) return { ok: false, code: "validation_failed" };
  if (!reason || reason.trim().length === 0)          return { ok: false, code: "validation_failed" };

  const auth = await requireStaff(PERMISSION);
  if (!auth.ok) return { ok: false, code: "not_allowed" };
  const actor = auth.user;

  const rl = await checkBankActionLimit(actor.id);
  if (!rl.ok) return { ok: false, code: "rate_limited" };

  try {
    await requireStepUp(actor.id, code);
  } catch (err) {
    const e = err as { code?: string };
    if (e.code === "mfa_required") return { ok: false, code: "mfa_required" };
    throw err;
  }

  const sb = await createSupabaseServerClient();
  const sbService = await createSupabaseServiceRoleClient();

  const { data: order } = await sb
    .from("orders")
    .select("id, user_id, status, payment_provider, profiles(email)")
    .eq("id", orderId)
    .single();

  if (!order || order.payment_provider !== "bank_transfer") return { ok: false, code: "not_found" };
  if (order.status !== "pending_verification")               return { ok: false, code: "validation_failed" };

  // Cancel the order — guard against a concurrent payment completing.
  // payment_provider guard ensures we only cancel bank-transfer orders.
  const { error: orderErr, count: orderCount } = await sbService
    .from("orders")
    .update({ status: "cancelled", cancel_reason: reason.trim() })
    .eq("id", orderId)
    .eq("status", "pending_verification")
    .eq("payment_provider", "bank_transfer");

  if (orderErr) return { ok: false, code: "unknown" };
  if (orderCount === 0) return { ok: false, code: "validation_failed", reason: "already_done" };

  // Audit row.
  await sbService.from("admin_audit_log").insert({
    actor_id:    actor.id,
    action:      "bank_transfer.reject",
    entity_type: "order",
    entity_id:   orderId,
  });

  // Queue rejection email (AC13).
  const buyerEmail = Array.isArray(order.profiles)
    ? order.profiles[0]?.email
    : (order.profiles as { email?: string | null } | null)?.email;

  if (buyerEmail) {
    await sbService.from("email_logs").insert({
      to_email:     buyerEmail,
      template:     "bank_rejected",
      related_type: "order",
      related_id:   orderId,
      status:       "queued",
    });
  }

  return { ok: true };
}

// ─── reopenBankOrder (AC10) ───────────────────────────────────────────────────

export async function reopenBankOrder(
  orderId: string,
  note: string,
  code: string | undefined,
): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(orderId).success) return { ok: false, code: "validation_failed" };
  if (!note || note.trim().length === 0)              return { ok: false, code: "validation_failed" };

  const auth = await requireStaff(PERMISSION);
  if (!auth.ok) return { ok: false, code: "not_allowed" };
  const actor = auth.user;

  const rl = await checkBankActionLimit(actor.id);
  if (!rl.ok) return { ok: false, code: "rate_limited" };

  try {
    await requireStepUp(actor.id, code);
  } catch (err) {
    const e = err as { code?: string };
    if (e.code === "mfa_required") return { ok: false, code: "mfa_required" };
    throw err;
  }

  const sb = await createSupabaseServerClient();
  const sbService = await createSupabaseServiceRoleClient();

  const { data: order } = await sb
    .from("orders")
    .select("id, status, cancel_reason, payment_provider")
    .eq("id", orderId)
    .single();

  if (!order || order.payment_provider !== "bank_transfer") return { ok: false, code: "not_found" };

  // AC10: only expired-cancelled orders can be reopened.
  if (order.status !== "cancelled")        return { ok: false, code: "validation_failed" };
  if (order.cancel_reason !== "expired")   return { ok: false, code: "validation_failed" };

  // cancel_reason guard prevents reopening a manually-cancelled order.
  const { error: orderErr, count } = await sbService
    .from("orders")
    .update({ status: "pending_verification", cancel_reason: null })
    .eq("id", orderId)
    .eq("status", "cancelled")
    .eq("cancel_reason", "expired");

  if (orderErr) return { ok: false, code: "unknown" };
  if (count === 0) return { ok: false, code: "already_done" };

  await sbService.from("admin_audit_log").insert({
    actor_id:    actor.id,
    action:      "bank_transfer.reopen",
    entity_type: "order",
    entity_id:   orderId,
  });

  return { ok: true };
}
