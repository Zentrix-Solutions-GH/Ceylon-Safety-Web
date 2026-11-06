import "server-only";

import { createSupabaseServiceRoleClient, createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types/auth";
import type { LikeResult, LikeStatusResult } from "@/types/comment";

type ToggleLikeResult = ActionResult<LikeResult>;

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

function isRateLimitError(msg: string): boolean {
  return msg.includes("ceylonsafety: rate_limited");
}

export async function toggleLike(
  userId: string,
  articleId: string
): Promise<ToggleLikeResult> {
  // Service role for read-only visibility check (must bypass article RLS).
  const serviceRole = createSupabaseServiceRoleClient();
  // User-scoped client for writes — enforces article_likes RLS (user_id = auth.uid()).
  const supabase = await createSupabaseServerClient();

  // Check article visibility
  const { data: article } = await serviceRole
    .from("articles")
    .select("status, published_at, deleted_at, like_count")
    .eq("id", articleId)
    .single();

  if (!article || !isArticleVisible(article)) {
    return { ok: false, code: "not_allowed" };
  }

  // Check if user already liked (use server client so RLS applies)
  const { data: existing } = await supabase
    .from("article_likes")
    .select("article_id")
    .eq("article_id", articleId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    // Remove like — RLS enforces user_id = auth.uid()
    await supabase
      .from("article_likes")
      .delete()
      .eq("article_id", articleId)
      .eq("user_id", userId);
  } else {
    // Add like — RLS enforces user_id = auth.uid() and active status
    const { error } = await supabase
      .from("article_likes")
      .insert({ article_id: articleId, user_id: userId });

    if (error) {
      if (isRateLimitError(error.message)) {
        return { ok: false, code: "rate_limited" };
      }
      return { ok: false, code: "unknown" };
    }
  }

  // Read updated count via service role (public read, no user context needed)
  const { data: updated } = await serviceRole
    .from("articles")
    .select("like_count")
    .eq("id", articleId)
    .single();

  return {
    ok: true,
    liked: !existing,
    count: updated?.like_count ?? 0,
  };
}

export async function getLikeStatus(
  userId: string | null,
  articleId: string
): Promise<LikeStatusResult> {
  const supabase = createSupabaseServiceRoleClient();

  const { data: article } = await supabase
    .from("articles")
    .select("like_count, status, published_at, deleted_at")
    .eq("id", articleId)
    .single();

  // Hidden/draft/future articles return zero count with no liked state
  if (!article || !isArticleVisible(article)) {
    return { liked: null, count: 0 };
  }

  const count = article.like_count ?? 0;

  if (!userId) {
    return { liked: null, count };
  }

  const { data: existing } = await supabase
    .from("article_likes")
    .select("article_id")
    .eq("article_id", articleId)
    .eq("user_id", userId)
    .maybeSingle();

  return { liked: existing != null, count };
}
