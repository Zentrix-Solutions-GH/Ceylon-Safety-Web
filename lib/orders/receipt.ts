import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { serverConfig, publicConfig } from "@/lib/config";
import { sendEmail } from "@/lib/resend/client";
import { renderReceiptEmail } from "@/lib/resend/templates/purchase-receipt";
import { renderBankApprovedEmail } from "@/lib/resend/templates/bank-approved";
import { safeErrorMessage } from "@/lib/errors";

type SB = SupabaseClient<Database>;

const REFUND_POLICY_PATH = "/refund-policy";

async function checkEmailBudget(sb: SB): Promise<boolean> {
  const utcMidnight = new Date(
    new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Colombo" }) + "T00:00:00+05:30",
  );

  const { count, error } = await (sb
    .from("email_logs")
    .select("id", { count: "exact", head: true })
    .in("status", ["sent", "queued"])
    .gte("created_at", utcMidnight.toISOString()) as unknown as Promise<{
    count: number | null;
    error: unknown;
  }>);

  if (error) {
    console.error("receipt: budget_check_failed", { message: safeErrorMessage(error) });
    return true; // fail open — allow send if we can't count
  }

  return (count ?? 0) < serverConfig.emailDailyLimit;
}

export async function ensureReceiptEmail(
  orderId: string,
  sb: SB,
): Promise<{ ok: boolean }> {
  // AC8: check email budget before sending
  const withinBudget = await checkEmailBudget(sb);
  if (!withinBudget) {
    console.error("receipt: email_daily_limit_reached", { order_id: orderId });
    return { ok: false };
  }

  // Fetch order with buyer email via profiles join
  const { data: order, error: orderError } = await sb
    .from("orders")
    .select("id, order_number, status, payment_method, total_cents, created_at, user_id, profiles(email)")
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    console.error("receipt: order_not_found", { order_id: orderId, message: safeErrorMessage(orderError) });
    return { ok: false };
  }

  if (order.status !== "paid") {
    return { ok: false };
  }

  const isBank = order.payment_method === "bank_transfer";

  // EC6: bank_approved has no unique index — check email_logs before sending
  if (isBank) {
    const { data: existing } = await sb
      .from("email_logs")
      .select("id")
      .eq("template", "bank_approved")
      .eq("related_type", "order")
      .eq("related_id", orderId)
      .limit(1);
    if (existing && existing.length > 0) {
      return { ok: true };
    }
  }

  const buyerEmail = Array.isArray(order.profiles)
    ? (order.profiles[0] as { email: string } | undefined)?.email
    : (order.profiles as { email: string } | null)?.email;

  if (!buyerEmail) {
    console.error("receipt: buyer_email_missing", { order_id: orderId });
    return { ok: false };
  }

  // Fetch items with entitlements
  const { data: items, error: itemsError } = await sb
    .from("order_items")
    .select("id, title_snapshot, language, line_total_cents, entitlements(id)")
    .eq("order_id", orderId);

  if (itemsError || !items) {
    console.error("receipt: items_not_found", { order_id: orderId, message: safeErrorMessage(itemsError) });
    return { ok: false };
  }

  const appUrl = publicConfig.appUrl;
  const template = isBank ? "bank_approved" : "receipt";

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

  const { subject, html, text } = isBank
    ? renderBankApprovedEmail(emailData)
    : renderReceiptEmail(emailData);

  try {
    await sendEmail({
      to: buyerEmail,
      template,
      relatedType: "order",
      relatedId: orderId,
      subject,
      html,
      text,
    });
  } catch (err) {
    console.error("receipt: send_failed", { order_id: orderId, message: safeErrorMessage(err) });
    return { ok: false };
  }

  return { ok: true };
}
