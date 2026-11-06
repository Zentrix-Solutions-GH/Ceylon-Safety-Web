import "server-only";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types/auth";
import type { PostCommentResult, RateLimitReason } from "@/types/comment";

type PostCommentActionResult = ActionResult<PostCommentResult> | {
  ok: false;
  code: "rate_limited";
  reason: RateLimitReason;
} | { ok: false; code: "validation_failed" | "not_allowed" | "unknown" };

// Strip control characters (U+0000–U+001F, U+007F) and Unicode direction
// overrides (U+200F, U+202A–U+202E, U+2066–U+2069) before saving.
const STRIP_PATTERN =
  /[\u0000-\u001F\u007F‏‪-‮⁦-⁩]/g;

function sanitiseText(raw: string): string {
  return raw.replace(STRIP_PATTERN, "");
}

function isArticleVisible(article: {
  status: string;
  published_at: string | null;
  deleted_at: string | null;
}): boolean {
  if (article.status !== "published") return false;
  if (article.deleted_at != null) return false;
  if (!article.published_at) return false;
  if (new Date(article.published_at) > new Date()) return false;
  return true;
}

function parseRateLimitReason(msg: string): RateLimitReason | null {
  const match = msg.match(/ceylonsafety: rate_limited reason=(\S+)/);
  if (!match) return null;
  const reason = match[1];
  if (reason === "hourly" || reason === "pending_cap") return reason;
  return null;
}

export async function postComment(
  userId: string,
  articleId: string,
  rawText: string
): Promise<PostCommentActionResult> {
  const body = sanitiseText(rawText).trim();

  if (body.length === 0 || body.length > 2000) {
    return { ok: false, code: "validation_failed" };
  }

  const supabase = createSupabaseServiceRoleClient();

  // Verify article is visible
  const { data: article } = await supabase
    .from("articles")
    .select("status, published_at, deleted_at")
    .eq("id", articleId)
    .single();

  if (!article || !isArticleVisible(article)) {
    return { ok: false, code: "not_allowed" };
  }

  const { data, error } = await supabase
    .from("article_comments")
    .insert([{ article_id: articleId, user_id: userId, body, status: "pending" }])
    .select("id")
    .single();

  if (error) {
    const reason = parseRateLimitReason(error.message);
    if (reason) {
      return { ok: false, code: "rate_limited", reason };
    }
    return { ok: false, code: "unknown" };
  }

  return { ok: true, id: data.id };
}
