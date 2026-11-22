import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { ReceiptEmailData } from "@/lib/resend/templates/purchase-receipt";
import { safeErrorMessage } from "@/lib/errors";

export type SB = SupabaseClient<Database>;

/** Returns the UTC start of today's calendar day in the Asia/Colombo timezone. */
export function colomboTodayUtc(): Date {
  return new Date(
    new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Colombo" }) + "T00:00:00+05:30",
  );
}

export type RawItem = {
  id: string;
  title_snapshot: string;
  language: string;
  line_total_cents: number;
  entitlements: Array<{ id: string }>;
};

/** Fetches order_items with entitlements for an order. Returns null and logs on error. */
export async function fetchOrderItems(
  orderId: string,
  sb: SB,
): Promise<RawItem[] | null> {
  const { data, error } = await sb
    .from("order_items")
    .select("id, title_snapshot, language, line_total_cents, entitlements(id)")
    .eq("order_id", orderId);

  if (error || !data) {
    console.error("orders: items_not_found", { order_id: orderId, message: safeErrorMessage(error) });
    return null;
  }

  return data as RawItem[];
}

/** Builds the ReceiptEmailData payload from an order + its items. */
export function buildEmailData(
  order: {
    order_number: unknown;
    created_at: unknown;
    total_cents: unknown;
  },
  items: RawItem[],
  appUrl: string,
  supportEmail: string,
  refundPolicyUrl: string,
  orderPageUrl?: string,
): ReceiptEmailData {
  return {
    orderNumber: order.order_number as string,
    orderDate: order.created_at as string,
    items: items.map((item) => ({
      titleSnapshot: item.title_snapshot,
      language: item.language ?? "en",
      lineTotalCents: item.line_total_cents,
      entitlementId: item.entitlements[0].id,
    })),
    totalCents: order.total_cents as number,
    appUrl,
    supportEmail,
    refundPolicyUrl,
    orderPageUrl,
  };
}
