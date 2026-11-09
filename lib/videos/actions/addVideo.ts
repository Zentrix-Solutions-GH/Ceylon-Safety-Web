import "server-only";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/server";
import { writeAuditRow } from "@/lib/audit/index";
import { addVideoSchema } from "@/lib/validation/video";
import { extractYouTubeId } from "@/lib/content/youtube";
import { copyYouTubeThumbnail } from "@/lib/videos/thumbnailCopy";
import { validateMediaAsset } from "@/lib/media/validateMediaAsset";
import { mapRow, type VideoRow } from "@/lib/videos/mapRow";
import { ANON_ACTOR } from "@/lib/engagement/actions/constants";
import type { AddVideoInput, AddVideoResult } from "@/types/video";

export async function addVideo(input: AddVideoInput): Promise<AddVideoResult> {
  const auth = await requireStaff("videos.*");
  if (!auth.ok) {
    try {
      await writeAuditRow({
        action: "permission.denied",
        actorId: ANON_ACTOR,
        entityType: "video",
        entityId: "",
        after: { permission: "videos.*" },
      });
    } catch {}
    return { ok: false, code: "not_allowed" };
  }

  const actorId = auth.user.id;

  const parsed = addVideoSchema.safeParse(input);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0] as string | undefined;
    return { ok: false, code: "validation_failed", field: field ?? "youtubeLink" };
  }

  const { youtubeLink, title, description, categoryId, customThumbnailMediaId } = parsed.data;

  const youtubeId = extractYouTubeId(youtubeLink);
  if (!youtubeId) return { ok: false, code: "validation_failed", field: "youtubeLink" };

  const supabase = createSupabaseServiceRoleClient();

  let thumbnailKey: string;
  let thumbnailSource: "youtube_copy" | "custom";
  let thumbnailWarning: string | undefined;

  if (customThumbnailMediaId) {
    const mediaResult = await validateMediaAsset(customThumbnailMediaId, supabase);
    if (!mediaResult.ok) {
      return { ok: false, code: "validation_failed", field: "customThumbnailMediaId" };
    }
    thumbnailKey = mediaResult.key;
    thumbnailSource = "custom";
  } else {
    const copyResult = await copyYouTubeThumbnail(youtubeId);
    if (!copyResult.ok) return { ok: false, code: "unknown" };
    thumbnailKey = copyResult.thumbnailKey;
    thumbnailSource = copyResult.thumbnailSource;
    if (copyResult.placeholderUsed) {
      thumbnailWarning = "Thumbnail copy failed. Please upload a custom thumbnail.";
    }
  }

  const { data, error } = await supabase
    .from("videos")
    .insert({
      youtube_id: youtubeId,
      title,
      description: description ?? null,
      category_id: categoryId,
      thumbnail_key: thumbnailKey,
      thumbnail_source: thumbnailSource,
      locale: "en",
      status: "draft",
    })
    .select("id, youtube_id, title, description, category_id, thumbnail_key, thumbnail_source, locale, status, published_at, updated_at, created_at")
    .single();

  if (error) {
    // Unique constraint on youtube_id WHERE deleted_at IS NULL — treat as validation failure (EC10)
    if ((error as { code?: string }).code === "23505") {
      return { ok: false, code: "validation_failed", field: "youtubeLink" };
    }
    return { ok: false, code: "unknown" };
  }

  const video = mapRow(data as VideoRow);

  try {
    await writeAuditRow({
      action: "video.add",
      actorId,
      entityType: "video",
      entityId: video.id,
      after: { youtubeId, title, categoryId, thumbnailSource },
    });
  } catch {}

  return { ok: true, video, ...(thumbnailWarning ? { thumbnailWarning } : {}) };
}
