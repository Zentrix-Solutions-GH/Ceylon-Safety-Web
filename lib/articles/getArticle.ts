import "server-only";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type {
  GetArticleResponse,
  PublicArticle,
  ResolvedVideoNode,
  ResolvedDocumentNode,
  RefTargetStatus,
} from "@/types/article";

// Cache tag names exported for the frontend page layer.
export const ARTICLE_LIST_CACHE_TAG = "articles-list";
export const articleCacheTag = (id: string) => `article:${id}`;
export const articleSlugCacheTag = (slug: string) => `article-slug:${slug}`;

export async function getArticle(slug: string): Promise<GetArticleResponse> {
  const supabase = createSupabaseServiceRoleClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("articles")
    .select(
      `id, slug, title, excerpt, cover_image_key, cover_image_alt,
       seo_title, seo_description, published_at, like_count, comment_count, body,
       categories!inner(id, name, slug),
       authors!inner(name),
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

  // Resolve video statuses via separate lookup (EC4)
  const videoRefIds = rawRefs
    .filter((r) => r.ref_type === "video")
    .map((r) => r.ref_id);
  const videoStatusMap = new Map<string, string>();
  if (videoRefIds.length > 0) {
    const { data: videos } = await supabase
      .from("videos")
      .select("id, status")
      .in("id", videoRefIds);
    if (videos) {
      for (const v of videos as Array<{ id: string; status: string }>) {
        videoStatusMap.set(v.id, v.status);
      }
    }
  }

  const resolvedVideos: ResolvedVideoNode[] = rawRefs
    .filter((r) => r.ref_type === "video")
    .map((r) => {
      const videoStatus = videoStatusMap.get(r.ref_id);
      const status: RefTargetStatus =
        videoStatus === "published"
          ? "published"
          : videoStatus === "hidden"
          ? "hidden"
          : videoStatus === "deleted"
          ? "deleted"
          : "not_found";
      return { nodeId: r.node_id, videoId: r.ref_id, status };
    });

  // Documents: always "not_shown" until S-071
  const resolvedDocuments: ResolvedDocumentNode[] = rawRefs
    .filter((r) => r.ref_type === "document")
    .map((r) => ({ nodeId: r.node_id, documentId: r.ref_id, status: "not_shown" as const }));

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
    authorName: (data.authors as unknown as { name: string }).name,
    publishedAt: data.published_at as string,
    body: data.body as unknown as PublicArticle["body"],
    likeCount: (data.like_count as number) ?? 0,
    commentCount: (data.comment_count as number) ?? 0,
    resolvedVideos,
    resolvedDocuments,
  };

  return { ok: true, data: article };
}
