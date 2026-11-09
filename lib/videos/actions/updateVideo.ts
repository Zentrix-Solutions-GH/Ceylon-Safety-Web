import "server-only";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/server";
import { writeAuditRow } from "@/lib/audit/index";
import { updateVideoSchema } from "@/lib/validation/video";
import { validateMediaAsset } from "@/lib/media/validateMediaAsset";
import { mapRow, type VideoRow } from "@/lib/videos/mapRow";
import { ANON_ACTOR } from "@/lib/engagement/actions/constants";
import type { UpdateVideoInput, UpdateVideoResult } from "@/types/video";

export async function updateVideo(input: UpdateVideoInput): Promise<UpdateVideoResult> {
  const auth = await requireStaff("videos.*");
  if (!auth.ok) {
    try {
      await writeAuditRow({
        action: "permission.denied",
        actorId: ANON_ACTOR,
        entityType: "video",
        entityId: input.id ?? "",
        after: { permission: "videos.*" },
      });
    } catch {}
    return { ok: false, code: "not_allowed" };
  }

  const actorId = auth.user.id;

  const parsed = updateVideoSchema.safeParse(input);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0] as string | undefined;
    return { ok: false, code: "validation_failed", field: field ?? "id" };
  }

  const { id, title, description, categoryId, customThumbnailMediaId, updatedAt } = parsed.data;

  const supabase = createSupabaseServiceRoleClient();

  type VideoUpdate = {
    title?: string;
    description?: string | null;
    category_id?: string;
    thumbnail_key?: string;
    thumbnail_source?: string;
  };
  const updates: VideoUpdate = {};
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (categoryId !== undefined) updates.category_id = categoryId;

  if (customThumbnailMediaId !== undefined) {
    if (customThumbnailMediaId === null) {
      // Remove custom thumbnail — not supported in v1; ignore silently
    } else {
      const mediaResult = await validateMediaAsset(customThumbnailMediaId, supabase);
      if (!mediaResult.ok) {
        return { ok: false, code: "validation_failed", field: "customThumbnailMediaId" };
      }
      updates.thumbnail_key = mediaResult.key;
      updates.thumbnail_source = "custom";
    }
  }

  const { data, error } = await supabase
    .from("videos")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(updates as any)
    .eq("id", id)
    .eq("updated_at", updatedAt)
    .select("id, youtube_id, title, description, category_id, thumbnail_key, thumbnail_source, locale, status, published_at, updated_at, created_at")
    .single();

  if (error) {
    if ((error as { code?: string }).code === "PGRST116") {
      const { data: exists } = await supabase
        .from("videos")
        .select("id")
        .eq("id", id)
        .maybeSingle();
      if (!exists) return { ok: false, code: "not_found" };
      return { ok: false, code: "version_conflict" };
    }
    return { ok: false, code: "unknown" };
  }

  const video = mapRow(data as VideoRow);

  try {
    await writeAuditRow({
      action: "video.update",
      actorId,
      entityType: "video",
      entityId: video.id,
      after: updates,
    });
  } catch {}

  return { ok: true, video };
}
