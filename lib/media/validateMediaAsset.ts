import "server-only";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

type ValidateResult =
  | { ok: true; key: string }
  | { ok: false; code: "not_found" | "not_ready" | "unknown" };

type MediaAssetRow = { file_key: string; status: string } | null;

/**
 * Checks that a media asset id exists and is in the `ready` state.
 * Used by video and article actions to validate custom thumbnail ids (AC6, EC8).
 */
export async function validateMediaAsset(
  mediaId: string,
  supabase?: ReturnType<typeof createSupabaseServiceRoleClient>
): Promise<ValidateResult> {
  const db = supabase ?? createSupabaseServiceRoleClient();

  const { data, error } = await db
    .from("media_assets")
    .select("file_key, status")
    .eq("id", mediaId)
    .maybeSingle();

  if (error) return { ok: false, code: "unknown" };
  const row = data as MediaAssetRow;
  if (!row) return { ok: false, code: "not_found" };
  if (row.status !== "ready") return { ok: false, code: "not_ready" };

  return { ok: true, key: row.file_key };
}
