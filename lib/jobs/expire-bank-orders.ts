import "server-only";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

const DEFAULT_EXPIRY_DAYS = 7;
const DEFAULT_WARNING_DAYS = 1;

async function getSettings(
  sb: Awaited<ReturnType<typeof createSupabaseServiceRoleClient>>
): Promise<{ expiryDays: number; warningDays: number }> {
  const { data } = await sb
    .from("site_settings")
    .select("key, value")
    .in("key", ["bank_order_expiry_days", "bank_order_warning_days"]);

  const rows = (data ?? []) as Array<{ key: string; value: unknown }>;
  const get = (key: string, def: number): number => {
    const row = rows.find((r) => r.key === key);
    return typeof row?.value === "number" ? row.value : def;
  };

  return {
    expiryDays:  get("bank_order_expiry_days",  DEFAULT_EXPIRY_DAYS),
    warningDays: get("bank_order_warning_days",  DEFAULT_WARNING_DAYS),
  };
}

// ─── expireBankOrdersJob (AC11) ───────────────────────────────────────────────
//
// Runs daily. For each pending_verification bank-transfer order:
//   1. If within the warning window and not yet warned: queue bank_expiring email, set bank_expiry_warned_at.
//   2. If past expiry and no slip is awaiting_second_approval: cancel order (cancel_reason='expired'), queue bank_rejected email.
//   3. If past expiry and a slip is awaiting_second_approval: skip cancellation (flag in log).

export async function expireBankOrdersJob(): Promise<{ ok: boolean }> {
  const sb = await createSupabaseServiceRoleClient();

  const { expiryDays, warningDays } = await getSettings(sb);

  const now = new Date();

  const expiryMs  = expiryDays  * 24 * 60 * 60 * 1000;
  const warningMs = (expiryDays - warningDays) * 24 * 60 * 60 * 1000;

  // Fetch all pending_verification bank-transfer orders.
  const { data: orders, error } = await sb
    .from("orders")
    .select("id, user_id, created_at, bank_expiry_warned_at, profiles(email)")
    .eq("status", "pending_verification")
    .eq("payment_provider", "bank_transfer")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[expire-bank-orders] failed to fetch orders:", error.message);
    return { ok: false };
  }

  if (!orders || orders.length === 0) return { ok: true };

  const orderIds = orders.map((o: { id: string }) => o.id);

  // Fetch slips that are awaiting_second_approval (don't cancel these orders).
  const { data: pendingSlips } = await sb
    .from("bank_transfer_slips")
    .select("order_id, status")
    .eq("status", "awaiting_second_approval")
    .in("order_id", orderIds);

  const secondApprovalOrderIds = new Set(
    ((pendingSlips ?? []) as Array<{ order_id: string }>).map((s) => s.order_id)
  );

  for (const order of orders as Array<{
    id: string;
    user_id: string;
    created_at: string;
    bank_expiry_warned_at: string | null;
    profiles: { email: string | null } | Array<{ email: string | null }> | null;
  }>) {
    const ageMs = now.getTime() - new Date(order.created_at).getTime();

    const buyerEmail = Array.isArray(order.profiles)
      ? order.profiles[0]?.email
      : (order.profiles as { email: string | null } | null)?.email;

    // ── Expiry path ─────────────────────────────────────────────────────────
    if (ageMs >= expiryMs) {
      if (secondApprovalOrderIds.has(order.id)) {
        // AC11: mid-review; flag in log but do not cancel.
        console.warn("[expire-bank-orders] skipping mid-review order", { order_id: order.id });
        continue;
      }

      // Cancel the order — only if still pending_verification (guards against
      // a concurrent approve completing between the fetch and this update).
      const { error: cancelErr, count: cancelCount } = await sb
        .from("orders")
        .update({ status: "cancelled", cancel_reason: "expired" })
        .eq("id", order.id)
        .eq("status", "pending_verification");

      if (cancelErr) {
        console.error("[expire-bank-orders] cancel failed", { order_id: order.id, msg: cancelErr.message });
        continue;
      }

      // If count is 0 the order was paid concurrently — skip the email.
      if (cancelCount === 0) {
        console.warn("[expire-bank-orders] cancel skipped (order no longer pending)", { order_id: order.id });
        continue;
      }

      // Queue expiry email (bank_rejected template, AC13).
      if (buyerEmail) {
        const { error: emailErr } = await sb.from("email_logs").insert({
          to_email:     buyerEmail,
          template:     "bank_rejected",
          related_type: "order",
          related_id:   order.id,
          status:       "queued",
        });
        if (emailErr) {
          console.error("[expire-bank-orders] email queue failed", { order_id: order.id, msg: emailErr.message });
        }
      }

      continue;
    }

    // ── Warning path ────────────────────────────────────────────────────────
    if (ageMs >= warningMs && !order.bank_expiry_warned_at) {
      const { error: warnErr } = await sb
        .from("orders")
        .update({ bank_expiry_warned_at: now.toISOString() })
        .eq("id", order.id)
        .eq("status", "pending_verification");

      if (warnErr) {
        console.error("[expire-bank-orders] warning update failed", { order_id: order.id, msg: warnErr.message });
        continue;
      }

      if (buyerEmail) {
        await sb.from("email_logs").insert({
          to_email:     buyerEmail,
          template:     "bank_expiring",
          related_type: "order",
          related_id:   order.id,
          status:       "queued",
        });
      }
    }
  }

  return { ok: true };
}
