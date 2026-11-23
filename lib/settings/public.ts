import "server-only";
import { createSupabaseAnonClient } from "@/lib/supabase/server";
import type { PublicSettings } from "@/types/setting";

/**
 * Returns all site_settings rows where is_public = true.
 * Uses the anon client — no authentication required (AC1, analyst-gap).
 * RLS policy "site_settings_public_read" enforces the is_public filter at DB level.
 */
export async function getPublicSettings(): Promise<PublicSettings> {
  const supabase = createSupabaseAnonClient();
  const { data, error } = await supabase
    .from("site_settings")
    .select("key, value")
    .eq("is_public", true);

  if (error) {
    console.error("[settings/public] DB error fetching public settings — returning empty", error);
    return {};
  }
  if (!data) return {};

  const result: PublicSettings = {};
  for (const row of data) {
    result[row.key] = row.value;
  }
  return result;
}
