import "server-only";
import { createSupabaseAnonClient } from "@/lib/supabase/server";
import { resolveArticleRefs } from "@/lib/articles/resolveRefs";
import type { GetArticleResponse, PublicArticle } from "@/types/article";

// Cache tag names exported for the frontend page layer.
export const ARTICLE_LIST_CACHE_TAG = "articles-list";
export const articleCacheTag = (id: string) => `article:${id}`;
export const articleSlugCacheTag = (slug: string) => `article-slug:${slug}`;

export async function getArticle(slug: string): Promise<GetArticleResponse> {
  // Anon client: RLS policy articles_public_read enforces visibility at DB level.
  const supabase = createSupabaseAnonClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("articles")
    .select(
      `id, slug, title, excerpt, cover_image_key, cover_image_alt,
       seo_title, seo_description, published_at, like_count, comment_count, body,
       categories!inner(id, name, slug),
       authors(name),
       article_refs(ref_type, ref_id, node_id, phrase)`
    )
    .eq("slug", slug)
    .eq("status", "published")
    .lte("published_at", now)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data) {
    return { ok: false, code: "not_found" };
  }

  const rawRefs = (data.article_refs ?? []) as unknown as Array<{
    ref_type: string;
    ref_id: string;
    node_id: string;
    phrase: string | null;
  }>;

  const { resolvedVideos, resolvedDocuments } = await resolveArticleRefs(rawRefs);

  const article: PublicArticle = {
    id: data.id as string,
    slug: data.slug as string,
    title: data.title as string,
    excerpt: (data.excerpt as string | null) ?? null,
    coverImageKey: (data.cover_image_key as string | null) ?? null,
    coverImageAlt: (data.cover_image_alt as string | null) ?? null,
    seoTitle: (data.seo_title as string | null) ?? null,
    seoDescription: (data.seo_description as string | null) ?? null,
    category: data.categories as unknown as { id: string; name: string; slug: string },
    authorName: (data.authors as unknown as { name: string } | null)?.name ?? "",
    publishedAt: data.published_at as string,
    body: data.body as unknown as PublicArticle["body"],
    likeCount: (data.like_count as number) ?? 0,
    commentCount: (data.comment_count as number) ?? 0,
    resolvedVideos,
    resolvedDocuments,
  };

  return { ok: true, data: article };
}
