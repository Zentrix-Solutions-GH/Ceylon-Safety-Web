import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { safeErrorMessage } from "@/lib/errors";
import type { ReconcileResult } from "@/types/order";

type SB = SupabaseClient<Database>;

interface PendingCardOrder {
  id: string;
  order_number: string;
  created_at: string;
}

// Returns pending CARD orders older than `minutes` that have no successful
// payment event. Used by the reconcile job and exported for S-100/S-103.
export async function getPendingCardOrdersOlderThan(
  minutes: number,
  sb: SB
): Promise<PendingCardOrder[]> {
  const cutoff = new Date(Date.now() - minutes * 60 * 1000).toISOString();

  const { data, error } = await sb
    .from("orders")
    .select("id, order_number, created_at")
    .eq("status", "pending")
    .eq("payment_method", "card")
    .lt("created_at", cutoff);

  if (error) {
    throw new Error(safeErrorMessage(error));
  }

  const orders = (data ?? []) as PendingCardOrder[];
  if (orders.length === 0) return [];

  // Exclude any order that already has a successful payment event.
  const orderIds = orders.map((o) => o.id);
  const { data: successEvents, error: evtError } = await sb
    .from("payment_events")
    .select("order_id")
    .eq("outcome", "applied")
    .in("order_id", orderIds);

  if (evtError) {
    throw new Error(safeErrorMessage(evtError));
  }

  // Two-query pattern: a webhook processed between the two reads can cause a stale
  // order to appear in alerts. Harmless — reconcile only logs, never acts.
  const paidIds = new Set((successEvents ?? []).map((e) => (e as { order_id: string }).order_id));
  return orders.filter((o) => !paidIds.has(o.id));
}

// Lists pending CARD orders older than 15 minutes that have no successful
// payment event. If PayHere status look-up is not available (default), it
// only logs and alerts — it never marks an order paid.
export async function reconcileCardPayments(sb: SB): Promise<ReconcileResult> {
  let orders: PendingCardOrder[];
  try {
    orders = await getPendingCardOrdersOlderThan(15, sb);
  } catch (err) {
    console.error("reconcile: query_failed", { message: safeErrorMessage(err) });
    return { ok: false, alertCount: 0, orderNumbers: [] };
  }

  if (orders.length === 0) {
    console.log("reconcile: alertCount=0");
    return { ok: true, alertCount: 0, orderNumbers: [] };
  }

  const orderNumbers = orders.map((o) => o.order_number);
  // Log order numbers only — no billing data (AC6).
  console.warn(
    `reconcile: alertCount=${orders.length} orders=${orderNumbers.join(",")}`
  );

  return { ok: true, alertCount: orders.length, orderNumbers };
}
