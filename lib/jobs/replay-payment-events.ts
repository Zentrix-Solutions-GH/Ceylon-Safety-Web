import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { fulfilNotification } from "@/lib/orders/fulfil";
import { safeErrorMessage } from "@/lib/errors";

type SB = SupabaseClient<Database>;

// Selects payment_events with processed_at IS NULL and received_at older than
// 2 minutes, then applies each through fulfilNotification (AC1).
// A failing event is left unprocessed and raises an alert (AC2).
// The event_key unique index prevents double-processing when the job and
// PayHere's own retry overlap (AC1 idempotency).
export async function replayPaymentEvents(sb: SB): Promise<{ ok: boolean }> {
  const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();

  const { data: events, error } = await sb
    .from("payment_events")
    .select("id, order_id, event_key, status_code, provider_payment_id, amount_cents, currency")
    .is("processed_at", null)
    .lt("received_at", twoMinAgo)
    .limit(100);

  if (error) {
    console.error("replay: query_failed", { message: safeErrorMessage(error) });
    return { ok: false };
  }

  const rows = (events ?? []) as Array<{
    id: string;
    order_id: string;
    event_key: string;
    status_code: number | null;
    provider_payment_id: string | null;
    amount_cents: number | null;
    currency: string | null;
  }>;

  for (const row of rows) {
    try {
      await fulfilNotification(
        row.order_id,
        {
          eventId: row.id,
          statusCode: row.status_code ?? 0,
          paymentId: row.provider_payment_id ?? undefined,
          paymentDescription: "",
          amountCents: row.amount_cents,
          currency: row.currency ?? "",
        },
        sb,
      );

      // Mark processed only on success (AC2: failed event stays unprocessed).
      const { error: markError } = await sb
        .from("payment_events")
        .update({ processed_at: new Date().toISOString() })
        .eq("id", row.id);

      if (markError) {
        // fulfilNotification already succeeded; idempotency via event_key unique
        // index prevents double payment on retry, but we log to flag the gap.
        console.error("replay: mark_processed_failed", {
          event_id: row.id,
          order_id: row.order_id,
          message: safeErrorMessage(markError),
        });
      }
    } catch (err) {
      // AC2: raise alert, leave processed_at empty so the next run retries.
      console.error("replay: fulfil_failed", {
        event_id: row.id,
        order_id: row.order_id,
        message: safeErrorMessage(err),
      });
    }
  }

  return { ok: true };
}

// Job wrapper registered in JOB_REGISTRY.
export async function replayPaymentEventsJob(): Promise<{ ok: boolean }> {
  const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
  const sb = createSupabaseAdminClient();
  return replayPaymentEvents(sb);
}
