import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { publicConfig, serverConfig } from "@/lib/config";
import type { Database } from "@/types/database";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    publicConfig.supabaseUrl,
    publicConfig.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — cookies are read-only; safe to ignore
          }
        },
      },
    }
  );
}

export function createSupabaseServiceRoleClient() {
  return createClient<Database>(
    publicConfig.supabaseUrl,
    serverConfig.supabaseServiceRoleKey,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
