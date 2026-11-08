import "server-only";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/server";
import { writeAuditRow } from "@/lib/audit/index";
import { purgeVideo } from "@/lib/cache/purge";
import { setVideoStatusSchema } from "@/lib/validation/video";
import { mapRow, type VideoRow } from "@/lib/videos/mapRow";
import { ANON_ACTOR } from "@/lib/engagement/actions/constants";
import type { AuditEventName } from "@/types/audit";
import type {
  SetVideoStatusInput,
  SetVideoStatusResult,
  VideoStatusAction,
} from "@/types/video";

const ACTION_TO_AUDIT: Record<VideoStatusAction, AuditEventName> = {
  publish: "video.publish",
  hide: "video.hide",
  unhide: "video.unhide",
  delete: "video.delete",
};

export async function setVideoStatus(input: SetVideoStatusInput): Promise<SetVideoStatusResult> {
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

  const parsed = setVideoStatusSchema.safeParse(input);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0] as string | undefined;
    return { ok: false, code: "validation_failed", field: field ?? "id" };
  }

  const { id, action, publishedAt, updatedAt } = parsed.data;

  // publish requires publishedAt
  if (action === "publish" && !publishedAt) {
    return { ok: false, code: "validation_failed", field: "publishedAt" };
  }

  const supabase = createSupabaseServiceRoleClient();

  type VideoUpdate = {
    status?: string;
    published_at?: string | null;
    deleted_at?: string | null;
  };
  let updates: VideoUpdate;

  if (action === "delete") {
    updates = { deleted_at: new Date().toISOString() };
  } else if (action === "publish") {
    updates = { status: "published", published_at: publishedAt ?? null };
  } else if (action === "hide") {
    updates = { status: "hidden", published_at: null };
  } else {
    updates = { status: "published" };
  }

  const query = supabase
    .from("videos")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(updates as any)
    .eq("id", id)
    .eq("updated_at", updatedAt);

  // For non-delete actions, guard against operating on a soft-deleted row
  const finalQuery = action === "delete"
    ? query
    : query.is("deleted_at", null);

  const { data, error } = await finalQuery
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

  // Purge on hide or delete (design section 15); publish uses 60s cache window
  if (action === "hide" || action === "delete") {
    const purgeResult = await purgeVideo(id, actorId);
    if (!purgeResult.ok) {
      // Change is saved; return purge_failed so the admin can see the warning
      return { ok: false, code: "purge_failed" };
    }
  }

  try {
    await writeAuditRow({
      action: ACTION_TO_AUDIT[action],
      actorId,
      entityType: "video",
      entityId: id,
      after: updates,
    });
  } catch {}

  return { ok: true, video };
}
