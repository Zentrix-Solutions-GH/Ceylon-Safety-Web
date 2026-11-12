import "server-only";

import { createClient } from "@supabase/supabase-js";
import { publicConfig, serverConfig } from "@/lib/config";
import type { Database } from "@/types/database";

// Service-role client for webhook handlers that have no user session.
// Never import this in client components or public routes.
export function createSupabaseAdminClient() {
  return createClient<Database>(
    publicConfig.supabaseUrl,
    serverConfig.supabaseServiceRoleKey,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
