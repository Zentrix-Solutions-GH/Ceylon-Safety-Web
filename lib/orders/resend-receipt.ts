import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { serverConfig, publicConfig } from "@/lib/config";
import { sendEmail } from "@/lib/resend/client";
import { renderReceiptEmail } from "@/lib/resend/templates/purchase-receipt";
import { safeErrorMessage } from "@/lib/errors";
import {
  colomboTodayUtc,
  fetchOrderItems,
  buildEmailData,
  REFUND_POLICY_PATH,
  type RawItem,
} from "@/lib/orders/receipt-helpers";

type SB = SupabaseClient<Database>;

const RESEND_DAILY_LIMIT = 3;

/** Shared send logic used by both user-facing and admin resend. */
async function sendResendEmail(
  orderId: string,
  order: {
    order_number: unknown;
    created_at: unknown;
    total_cents: unknown;
    profiles: unknown;
  },
  sb: SB,
): Promise<{ ok: boolean; error?: string }> {
  const buyerEmail = Array.isArray(order.profiles)
    ? (order.profiles[0] as { email: string } | undefined)?.email
    : (order.profiles as { email: string } | null)?.email;

  if (!buyerEmail) {
    console.error("resend_receipt: buyer_email_missing", { order_id: orderId });
    return { ok: false, error: "Could not fetch buyer email" };
  }

  const items = await fetchOrderItems(orderId, sb);
  if (!items) return { ok: false, error: "Could not fetch order items" };

  if (items.some((item) => !item.entitlements?.[0]?.id)) {
    console.error("resend_receipt: entitlement_missing", { order_id: orderId });
    return { ok: false, error: "Entitlement missing for one or more items" };
  }

  const appUrl = publicConfig.appUrl;
  const emailData = buildEmailData(
    order,
    items as RawItem[],
    appUrl,
    serverConfig.supportEmail,
    `${appUrl}${REFUND_POLICY_PATH}`,
  );

  const { subject, html, text } = renderReceiptEmail(emailData);

  try {
    await sendEmail({
      to: buyerEmail,
      template: "receipt_resend",
      relatedType: "order",
      relatedId: orderId,
      subject,
      html,
      text,
    });
  } catch (err) {
    console.error("resend_receipt: send_failed", { order_id: orderId, message: safeErrorMessage(err) });
    return { ok: false, error: "Send failed" };
  }

  return { ok: true };
}

/** User-facing resend: owner check + 3/day rate limit. */
export async function resendMyReceiptLib(
  orderId: string,
  userId: string,
  sb: SB,
): Promise<{ ok: boolean; error?: string }> {
  const colomboToday = colomboTodayUtc();

  // Budget check (fail open — consistent with ensureReceiptEmail)
  const { count: budgetCount, error: budgetError } = await (sb
    .from("email_logs")
    .select("id", { count: "exact", head: true })
    .in("status", ["sent", "queued"])
    .gte("created_at", colomboToday.toISOString()) as unknown as Promise<{
    count: number | null;
    error: unknown;
  }>);

  if (!budgetError && (budgetCount ?? 0) >= serverConfig.emailDailyLimit) {
    console.error("resend_receipt: email_daily_limit_reached", { order_id: orderId });
    return { ok: false, error: "Email daily limit reached" };
  }

  // Owner check
  const { data: order, error: orderError } = await sb
    .from("orders")
    .select("id, order_number, status, payment_method, total_cents, created_at, user_id, profiles(email)")
    .eq("id", orderId)
    .eq("user_id", userId)
    .single();

  if (orderError || !order) {
    return { ok: false, error: "Order not found or not allowed" };
  }

  if (order.status !== "paid") {
    return { ok: false, error: "Order is not paid" };
  }

  // Rate limit: at most RESEND_DAILY_LIMIT per order per day (P1: fail closed on DB error)
  const { count: resendCount, error: resendCountError } = await (sb
    .from("email_logs")
    .select("id", { count: "exact", head: true })
    .eq("template", "receipt_resend")
    .eq("related_id", orderId)
    .gte("created_at", colomboToday.toISOString()) as unknown as Promise<{
    count: number | null;
    error: unknown;
  }>);

  if (resendCountError) {
    console.error("resend_receipt: rate_limit_check_failed", { order_id: orderId, message: safeErrorMessage(resendCountError) });
    return { ok: false, error: "Could not verify rate limit" };
  }

  if ((resendCount ?? 0) >= RESEND_DAILY_LIMIT) {
    return { ok: false, error: "Rate limit: too many resend requests today" };
  }

  return sendResendEmail(orderId, order, sb);
}

/**
 * Admin resend (AC6): no owner check, no per-user rate limit.
 * Called by S-089 with a service-role Supabase client.
 * Respects the shared email budget so a bulk admin action cannot exceed Resend's daily limit.
 */
export async function resendReceiptForOrder(
  orderId: string,
  sb: SB,
): Promise<{ ok: boolean; error?: string }> {
  const colomboToday = colomboTodayUtc();
  const { count: budgetCount, error: budgetError } = await (sb
    .from("email_logs")
    .select("id", { count: "exact", head: true })
    .in("status", ["sent", "queued"])
    .gte("created_at", colomboToday.toISOString()) as unknown as Promise<{
    count: number | null;
    error: unknown;
  }>);

  if (!budgetError && (budgetCount ?? 0) >= serverConfig.emailDailyLimit) {
    console.error("resend_receipt: email_daily_limit_reached", { order_id: orderId });
    return { ok: false, error: "Email daily limit reached" };
  }

  const { data: order, error: orderError } = await sb
    .from("orders")
    .select("id, order_number, status, payment_method, total_cents, created_at, user_id, profiles(email)")
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    return { ok: false, error: "Order not found" };
  }

  if (order.status !== "paid") {
    return { ok: false, error: "Order is not paid" };
  }

  return sendResendEmail(orderId, order, sb);
}
