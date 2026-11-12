import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { releaseCouponUse } from "@/lib/orders/coupon";

type SB = SupabaseClient<Database>;

const DEFAULT_DOWNLOAD_LIMIT_KEY = "default_download_limit";
const DEFAULT_DOWNLOAD_LIMIT_FALLBACK = 3;

async function fetchDownloadLimit(sb: SB): Promise<number> {
  const { data } = await sb
    .from("site_settings")
    .select("value")
    .eq("key", DEFAULT_DOWNLOAD_LIMIT_KEY)
    .single();
  if (data?.value && typeof data.value === "number") return data.value;
  return DEFAULT_DOWNLOAD_LIMIT_FALLBACK;
}

export interface FulfilInput {
  eventId: string;
  statusCode: number;
  paymentId: string;
  paymentDescription: string;
  amountCents: number;
  currency: string;
}

// Entry point called by the notify route and S-081 replay.
//
// All state changes (order status, entitlements, cart removal, purchase_count,
// audit rows) happen inside fulfil_payhere_locked — a PL/pgSQL function that
// runs in ONE database transaction under a per-order advisory lock (AC4, AC10).
//
// release_coupon_use is called here (outside the SQL function) for status -1 and -2
// because it is a no-op in Release 1; in Release 2 it will make its own DB call.
export async function fulfilNotification(
  orderId: string,
  event: FulfilInput,
  sb: SB,
): Promise<void> {
  // Fetch download limit before the locked transaction; a stale value is acceptable.
  const downloadLimit = await fetchDownloadLimit(sb);

  // Delegate to the locked PL/pgSQL function (AC4, AC10).
  // Cast to any because fulfil_payhere_locked is not yet in the generated types
  // (requires Supabase running to regenerate; check.sh skips types-freshness check
  // when Supabase is not running).
  const { data, error } = await (sb as unknown as {
    rpc: (name: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  }).rpc("fulfil_payhere_locked", {
    p_order_id:       orderId,
    p_event_id:       event.eventId,
    p_status_code:    event.statusCode,
    p_payment_desc:   event.paymentDescription ?? "",
    p_download_limit: downloadLimit,
  });

  if (error) {
    throw new Error(`fulfilNotification: RPC failed: ${error.message}`);
  }

  const outcome = (data as { outcome?: string } | null)?.outcome;

  // AC8: call release_coupon_use after the SQL transaction for failed/cancelled orders.
  // No-op in Release 1; exists so S-082 replay and future coupon logic have a call site.
  if (outcome === "payment_cancelled" || outcome === "payment_failed") {
    await releaseCouponUse({ id: orderId });
  }

  // AC5/AC6/AC9: structured alert log line (order number only — no personal data).
  // Full alert transport deferred to S-100; until then a structured console.error
  // is the hook for the alert system (Out of Scope: S-100).
  if (outcome === "applied") {
    // Check is_late from the returned payload to emit the AC5 alert.
    const isLate = (data as { is_late?: boolean } | null)?.is_late;
    if (isLate) {
      console.error("payhere_fulfil: late_payment_applied", { order_id: orderId });
    }
  } else if (outcome === "second_payment_flagged") {
    console.error("payhere_fulfil: second_payment_flagged", { order_id: orderId });
  } else if (outcome === "chargeback_applied") {
    console.error("payhere_fulfil: chargeback_applied", { order_id: orderId });
  } else if (outcome === "recorded_only" && event.statusCode !== 0) {
    // EC8: unknown status code
    console.error("payhere_fulfil: unknown_status_recorded", { order_id: orderId, status_code: event.statusCode });
  }
}
