import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { reconcileCardPayments } from "@/lib/orders/reconcile";

export async function reconcilePaymentsJob(): Promise<{ ok: boolean }> {
  const sb = createSupabaseAdminClient();
  const result = await reconcileCardPayments(sb);
  return { ok: result.ok };
}
