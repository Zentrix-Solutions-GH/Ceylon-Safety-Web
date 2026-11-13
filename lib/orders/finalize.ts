import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { FinalizeResult } from "@/types/order";
import { safeErrorMessage } from "@/lib/errors";

type SB = SupabaseClient<Database>;

// Stub — real implementation arrives with S-087 (invoice) and S-086 (email).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function ensureInvoice(_orderId: string, _sb: SB): Promise<{ ok: boolean }> {
  return { ok: false }; // not ready until S-087 merges
}

// Stub — real implementation arrives with S-086.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function ensureReceiptEmail(_orderId: string, _sb: SB): Promise<{ ok: boolean }> {
  return { ok: false }; // not ready until S-086 merges
}

// Runs finalize steps for a single order.
// Called by the job loop and by runFinalizeNow.
// A failing invoice step does NOT block the email step (AC4).
// Sets finalized_at only when both steps have been attempted without throwing.
export async function finalizeOrder(
  orderId: string,
  sb: SB,
): Promise<FinalizeResult> {
  let invoiceOk = false;
  let emailOk = false;

  try {
    const r = await ensureInvoice(orderId, sb);
    invoiceOk = r.ok;
  } catch (err) {
    console.error("finalize: ensureInvoice threw", { order_id: orderId, message: safeErrorMessage(err) });
  }

  try {
    const r = await ensureReceiptEmail(orderId, sb);
    emailOk = r.ok;
  } catch (err) {
    console.error("finalize: ensureReceiptEmail threw", { order_id: orderId, message: safeErrorMessage(err) });
  }

  // Set finalized_at only when both steps succeeded (AC3: "set finalized_at only
  // when both exist"). ok:false from either step means "not ready" — leave null
  // so the job re-claims the order on the next run. When S-086/S-087 replace the
  // stubs, failing steps return ok:false for real failures and the retry loop
  // picks the order up again without needing any change here.
  if (!invoiceOk || !emailOk) {
    return { orderId, invoiceOk, emailOk, finalizedAt: null };
  }

  const now = new Date().toISOString();
  const { error } = await sb
    .from("orders")
    .update({ finalized_at: now })
    .eq("id", orderId);

  if (error) {
    console.error("finalize: set finalized_at failed", { order_id: orderId, message: safeErrorMessage(error) });
    return { orderId, invoiceOk, emailOk, finalizedAt: null };
  }

  return { orderId, invoiceOk, emailOk, finalizedAt: now };
}

// Job body: claim paid orders with finalized_at IS NULL using SKIP LOCKED,
// run finalizeOrder for each. Alert if any order is paid for > 30 minutes
// without being finalized (AC5).
export async function finalizePaidOrders(sb: SB): Promise<{ ok: boolean }> {
  // AC5: alert on orders paid > 30 minutes ago with finalized_at IS NULL.
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: late } = await sb
    .from("orders")
    .select("id")
    .eq("status", "paid")
    .is("finalized_at", null)
    .lt("paid_at", thirtyMinAgo);

  if (late && late.length > 0) {
    console.error("finalize: unfinalized_paid_orders_alert", {
      count: late.length,
      order_ids: late.map((r) => r.id),
    });
  }

  // Claim orders via FOR UPDATE SKIP LOCKED by calling a DB function.
  // The function returns a set of order ids it has locked and returns.
  const { data: claimed, error } = await sb.rpc("claim_unfinalized_orders");

  if (error) {
    console.error("finalize: claim_unfinalized_orders failed", { message: safeErrorMessage(error) });
    return { ok: false };
  }

  const rows = (claimed as unknown as { id: string }[] | null) ?? [];

  for (const row of rows) {
    try {
      await finalizeOrder(row.id, sb);
    } catch (err) {
      console.error("finalize: order_loop_error", { order_id: row.id, message: safeErrorMessage(err) });
    }
  }

  return { ok: true };
}

// Runs the finalize steps for one order immediately (called after notify response).
// Idempotent: if finalized_at is already set, the ensureX stubs return false and
// no duplicate email is sent (email_logs unique guard in S-086).
export async function runFinalizeNow(orderId: string, sb: SB): Promise<void> {
  try {
    await finalizeOrder(orderId, sb);
  } catch (err) {
    console.error("finalize: runFinalizeNow error", { order_id: orderId, message: safeErrorMessage(err) });
  }
}
