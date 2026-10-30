import { createBrowserClient } from "@supabase/ssr";
import { publicConfig } from "@/lib/config.public";
import type { Database } from "@/types/database";

export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    publicConfig.supabaseUrl,
    publicConfig.supabaseAnonKey
  );
}
