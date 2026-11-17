import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { expirePendingOrders } from "@/lib/orders/expire";

export async function expirePendingOrdersJob(): Promise<{ ok: boolean }> {
  const sb = createSupabaseAdminClient();
  const result = await expirePendingOrders(sb);
  return { ok: result.ok };
}
