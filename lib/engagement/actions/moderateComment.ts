import "server-only";

import { z } from "zod";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/server";
import { writeAuditRow } from "@/lib/audit/index";
import { checkAdminWriteLimit, checkAdminDestructiveLimit } from "@/lib/ratelimit";
import { purgeArticle } from "@/lib/cache/purge";
import type { ModerateAction, ModerateCommentResult } from "@/types/comment";
import type { AuditEventName } from "@/types/audit";

const ANON_ACTOR = "00000000-0000-0000-0000-000000000000";

const moderateInputSchema = z.object({
  commentId: z.string().uuid(),
  action: z.enum(["approve", "reject", "delete", "restore"]),
});

// Legal transitions: { currentStatus -> allowed actions }
const LEGAL: Record<string, ModerateAction[]> = {
  pending:  ["approve", "reject"],
  approved: ["reject", "delete"],
  rejected: ["restore"],
};

const AUDIT_ACTION: Record<ModerateAction, AuditEventName> = {
  approve: "comment.approve",
  reject:  "comment.reject",
  delete:  "comment.delete",
  restore: "comment.restore",
};

const TARGET_STATUS: Record<ModerateAction, string> = {
  approve: "approved",
  reject:  "rejected",
  delete:  "deleted",
  restore: "approved",
};

// approve and delete both use the stricter 10/min destructive bucket (AC9)
const DESTRUCTIVE: ModerateAction[] = ["delete", "approve"];

export async function moderateComment(
  commentId: unknown,
  action: unknown
): Promise<ModerateCommentResult> {
  // Auth first — actor identity must come from the verified session, not the caller
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

  const parsed = moderateInputSchema.safeParse({ commentId, action });
  if (!parsed.success) return { ok: false, code: "validation_failed" };
  const validCommentId = parsed.data.commentId;
  const validAction = parsed.data.action as ModerateAction;

  // Rate limit: destructive actions (approve + delete) use the stricter 10/min bucket
  const isDestructive = DESTRUCTIVE.includes(validAction);
  const limitResult = isDestructive
    ? await checkAdminDestructiveLimit(actorId)
    : await checkAdminWriteLimit(actorId);
  if (!limitResult.ok) return { ok: false, code: "rate_limited" };

  const sb = createSupabaseServiceRoleClient();

  // Fetch comment
  const { data: comment, error: fetchError } = await sb
    .from("article_comments")
    .select("id, status, article_id, profiles:user_id ( suspended_at )")
    .eq("id", validCommentId)
    .single();

  if (fetchError || !comment) return { ok: false, code: "not_found" };

  const currentStatus = (comment as Record<string, unknown>)["status"] as string;
  const articleId = (comment as Record<string, unknown>)["article_id"] as string;
  const legal = LEGAL[currentStatus] ?? [];

  // Check wrong-state transition
  if (!legal.includes(validAction)) {
    const isAlreadyDone =
      (validAction === "approve" && currentStatus === "approved") ||
      (validAction === "reject" && currentStatus === "rejected") ||
      (validAction === "restore" && currentStatus === "approved") ||
      (validAction === "delete" && currentStatus === "deleted");
    return { ok: false, code: "validation_failed", reason: isAlreadyDone ? "already_done" : "wrong_state" };
  }

  const now = new Date().toISOString();

  // Atomic conditional UPDATE — guards EC2 (concurrent moderators).
  // The WHERE status = currentStatus clause means only one concurrent call wins;
  // the second gets 0 rows updated and returns already_done.
  const { data: updated, error: updateError } = await (sb
    .from("article_comments")
    .update({
      status: TARGET_STATUS[validAction],
      moderated_by: actorId,
      moderated_at: now,
    })
    .eq("id", validCommentId)
    .eq("status", currentStatus)
    .select("id") as unknown as Promise<{ data: { id: string }[] | null; error: unknown }>);

  if (updateError) return { ok: false, code: "unknown" };
  if (!updated || updated.length === 0) {
    return { ok: false, code: "validation_failed", reason: "already_done" };
  }

  // Write audit row
  try {
    await writeAuditRow({
      action: AUDIT_ACTION[validAction],
      actorId,
      entityType: "comment",
      entityId: validCommentId,
      after: { status: TARGET_STATUS[validAction] },
    });
  } catch {}

  // Purge cache
  const purgeResult = await purgeArticle(articleId, "publish", actorId);
  if (!purgeResult.ok) return { ok: false, code: "purge_failed" };

  return { ok: true };
}
