import "server-only";

import { z } from "zod";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/server";
import { writeAuditRow } from "@/lib/audit/index";
import { checkAdminWriteLimit } from "@/lib/ratelimit";
import { purgeArticle } from "@/lib/cache/purge";
import type { BulkRejectResult } from "@/types/comment";

const ANON_ACTOR = "00000000-0000-0000-0000-000000000000";
const MAX_IDS = 100;

const bulkRejectInputSchema = z.object({
  ids: z
    .array(z.string().uuid())
    .min(1, "at least one id required")
    .max(MAX_IDS, `at most ${MAX_IDS} ids per call`),
});

type BulkRejectActionResult =
  | BulkRejectResult
  | { ok: false; code: "not_allowed" | "rate_limited" | "validation_failed" | "purge_failed" | "unknown" };

export async function bulkRejectComments(
  ids: unknown
): Promise<BulkRejectActionResult> {
  // Auth first — actorId must come from the verified session
  const auth = await requireStaff("comments.moderate");
  if (!auth.ok) {
    try {
      await writeAuditRow({
        action: "permission.denied",
        actorId: ANON_ACTOR,
        entityType: "comment",
        entityId: "",
        after: { permission: "comments.moderate" },
      });
    } catch {}
    return { ok: false, code: "not_allowed" };
  }

  const actorId = auth.user.id;

  const parsed = bulkRejectInputSchema.safeParse({ ids });
  if (!parsed.success) return { ok: false, code: "validation_failed" };
  const validIds = parsed.data.ids;

  const limitResult = await checkAdminWriteLimit(actorId);
  if (!limitResult.ok) return { ok: false, code: "rate_limited" };

  const sb = createSupabaseServiceRoleClient();

  // Fetch only the pending ones from the given ids
  const { data: rows, error: fetchError } = await sb
    .from("article_comments")
    .select("id, status, article_id")
    .in("id", validIds);

  if (fetchError) return { ok: false, code: "unknown" };

  const fetched = (rows ?? []) as Array<{ id: string; status: string; article_id: string }>;
  const pendingRows = fetched.filter((r) => r.status === "pending");
  const pendingIds = pendingRows.map((r) => r.id);

  // Skipped = requested ids not in pending set
  const skipped = validIds.filter((id) => !pendingIds.includes(id));

  if (pendingIds.length > 0) {
    const now = new Date().toISOString();

    const { error: updateError } = await sb
      .from("article_comments")
      .update({ status: "rejected", moderated_by: actorId, moderated_at: now })
      .in("id", pendingIds);

    if (updateError) return { ok: false, code: "unknown" };

    // One audit row per rejected comment
    const auditPromises = pendingRows.map((r) =>
      writeAuditRow({
        action: "comment.reject",
        actorId,
        entityType: "comment",
        entityId: r.id,
        after: { status: "rejected" },
      }).catch(() => {})
    );
    await Promise.all(auditPromises);

    // Purge each affected article (deduplicated by article_id); surface first failure
    const articleIds = [...new Set(pendingRows.map((r) => r.article_id))];
    const purgeResults = await Promise.all(
      articleIds.map((aid) => purgeArticle(aid, "publish", actorId))
    );
    if (purgeResults.some((r) => !r.ok)) {
      return { ok: false, code: "purge_failed" };
    }
  }

  return { ok: true, rejected: pendingIds, skipped };
}
