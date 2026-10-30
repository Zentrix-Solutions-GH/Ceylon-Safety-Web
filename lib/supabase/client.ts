// Backend-owned scaffold (S-003 fully implements this file).
// Frontend uses this only to read display-only session state and sign out.
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

function requiredEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

// Validate at module load so a misconfigured deployment fails at startup, not at first auth call.
const SUPABASE_URL = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
const SUPABASE_ANON_KEY = requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

let _client: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (!_client) {
    _client = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return _client;
}
