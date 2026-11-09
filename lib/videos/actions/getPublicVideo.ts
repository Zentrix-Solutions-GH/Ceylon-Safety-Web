import "server-only";
import { createSupabaseAnonClient } from "@/lib/supabase/server";
import type { GetPublicVideoResult, PublicVideo } from "@/types/video";

type PublicVideoRow = {
  id: string;
  youtube_id: string;
  title: string;
  description: string | null;
  thumbnail_key: string;
};

/**
 * Returns a published video by our own id for the Home popup (AC9).
 * Uses the anon client so RLS applies as a second visibility guard.
 */
export async function getPublicVideo(id: string): Promise<GetPublicVideoResult> {
  const supabase = createSupabaseAnonClient();

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("videos")
    .select("id, youtube_id, title, description, thumbnail_key")
    .eq("id", id)
    .eq("status", "published")
    .is("deleted_at", null)
    .lte("published_at", now)
    .maybeSingle();

  if (error || !data) return { ok: false, code: "not_found" };

  const row = data as PublicVideoRow;
  const video: PublicVideo = {
    id: row.id,
    youtubeId: row.youtube_id,
    title: row.title,
    description: row.description,
    thumbnailKey: row.thumbnail_key,
  };

  return { ok: true, video };
}
