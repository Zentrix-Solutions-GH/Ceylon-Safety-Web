import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { safeErrorMessage } from "@/lib/errors";

type SB = SupabaseClient<Database>;

export interface ExpireResult {
  ok: boolean;
  cancelled: number;
}

// Calls the expire_pending_orders() DB function and returns the count of
// cancelled orders. Logs order count only — no billing data.
export async function expirePendingOrders(sb: SB): Promise<ExpireResult> {
  const { data, error } = await sb.rpc("expire_pending_orders");

  if (error) {
    console.error("expire: rpc_failed", { message: safeErrorMessage(error) });
    return { ok: false, cancelled: 0 };
  }

  const cancelled = (data as number | null) ?? 0;
  console.log(`expire: cancelled=${cancelled}`);
  return { ok: true, cancelled };
}
