import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { serverConfig, publicConfig } from "@/lib/config";
import { sendEmail } from "@/lib/resend/client";
import { renderReceiptEmail } from "@/lib/resend/templates/purchase-receipt";
import { safeErrorMessage } from "@/lib/errors";

type SB = SupabaseClient<Database>;

const REFUND_POLICY_PATH = "/refund-policy";
const RESEND_DAILY_LIMIT = 3;

export async function resendMyReceiptLib(
  orderId: string,
  userId: string,
  sb: SB,
): Promise<{ ok: boolean; error?: string }> {
  // Check email budget first
  const colomboToday = new Date(
    new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Colombo" }) + "T00:00:00+05:30",
  );
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

  // Fetch order — must be owned by this user; include buyer email via profiles join
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

  // Rate limit: at most RESEND_DAILY_LIMIT receipt_resend emails per order per day
  const { count: resendCount, error: resendCountError } = await (sb
    .from("email_logs")
    .select("id", { count: "exact", head: true })
    .eq("template", "receipt_resend")
    .eq("related_id", orderId)
    .gte("created_at", colomboToday.toISOString()) as unknown as Promise<{
    count: number | null;
    error: unknown;
  }>);

  if (!resendCountError && (resendCount ?? 0) >= RESEND_DAILY_LIMIT) {
    return { ok: false, error: "Rate limit: too many resend requests today" };
  }

  const buyerEmail = Array.isArray(order.profiles)
    ? (order.profiles[0] as { email: string } | undefined)?.email
    : (order.profiles as { email: string } | null)?.email;

  if (!buyerEmail) {
    console.error("resend_receipt: buyer_email_missing", { order_id: orderId });
    return { ok: false, error: "Could not fetch buyer email" };
  }

  // Fetch items and entitlements
  const { data: items, error: itemsError } = await sb
    .from("order_items")
    .select("id, title_snapshot, language, line_total_cents, entitlements(id)")
    .eq("order_id", orderId);

  if (itemsError || !items) {
    console.error("resend_receipt: items_not_found", { order_id: orderId, message: safeErrorMessage(itemsError) });
    return { ok: false, error: "Could not fetch order items" };
  }

  const appUrl = publicConfig.appUrl;

  const emailData = {
    orderNumber: order.order_number as string,
    orderDate: order.created_at as string,
    items: (items as Array<{
      id: string;
      title_snapshot: string;
      language: string;
      line_total_cents: number;
      entitlements: Array<{ id: string }>;
    }>).map((item) => ({
      titleSnapshot: item.title_snapshot,
      language: item.language ?? "en",
      lineTotalCents: item.line_total_cents,
      entitlementId: item.entitlements?.[0]?.id ?? "",
    })),
    totalCents: order.total_cents as number,
    appUrl,
    supportEmail: serverConfig.supportEmail,
    refundPolicyUrl: `${appUrl}${REFUND_POLICY_PATH}`,
  };

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
