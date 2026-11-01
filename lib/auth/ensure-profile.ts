import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";

/**
 * Ensures a profiles row exists for the given user.
 * Calls the same DB logic as the signup trigger via ensure_profile_for_user
 * (a service-role-only public wrapper around private.create_profile_for), so
 * sanitising rules cannot differ (AC2).
 *
 * Returns true when the profile exists or was created. False on DB error
 * (caller should treat as transient — the next request will retry).
 */
export async function ensureProfile(
  serviceClient: SupabaseClient<Database>,
  userId: string,
  email: string,
  appMeta: Record<string, unknown> = {},
  userMeta: Record<string, unknown> = {}
): Promise<boolean> {
  const { error } = await serviceClient.rpc("ensure_profile_for_user", {
    p_user_id: userId,
    p_email: email,
    p_app_meta: appMeta as Json,
    p_user_meta: userMeta as Json,
  });
  if (error) {
    console.error("[ensureProfile] RPC failed — code:", error.code ?? "unknown");
    return false;
  }
  return true;
}
