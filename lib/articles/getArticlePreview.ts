import "server-only";
import { unstable_noStore } from "next/cache";
import { requireStaff } from "@/lib/auth/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { resolveArticleRefs } from "@/lib/articles/resolveRefs";
import type {
  GetArticlePreviewResponse,
  ArticlePreviewData,
  ArticleStatus,
} from "@/types/article";

export async function getArticlePreview(id: string): Promise<GetArticlePreviewResponse> {
  unstable_noStore();

  const auth = await requireStaff("articles.*");
  if (!auth.ok) return { ok: false, code: "not_allowed" };

  const supabase = createSupabaseServiceRoleClient();

  // Intentionally no deleted_at filter: staff may preview soft-deleted articles
  // to review content before permanent removal.
  const { data, error } = await supabase
    .from("articles")
    .select(
      `id, slug, title, excerpt, cover_image_key, cover_image_alt,
       seo_title, seo_description, published_at, status, like_count, comment_count, body,
       categories!inner(id, name, slug),
       authors!inner(name),
       article_refs(ref_type, ref_id, node_id, phrase)`
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return { ok: false, code: "not_found" };

  // Look up cover image status from media_assets
  let coverImageStatus: string | null = null;
  const coverKey = data.cover_image_key as string | null;
  if (coverKey) {
    const { data: asset } = await supabase
      .from("media_assets")
      .select("status")
      .eq("file_key", coverKey)
      .maybeSingle();
    coverImageStatus = (asset?.status as string | null) ?? null;
  }

  const rawRefs = (data.article_refs ?? []) as Array<{
    ref_type: string;
    ref_id: string;
    node_id: string;
    phrase: string | null;
  }>;

  const { resolvedVideos, resolvedDocuments } = await resolveArticleRefs(rawRefs);

  const article = {
    id: data.id as string,
    slug: data.slug as string,
    title: data.title as string,
    excerpt: (data.excerpt as string | null) ?? null,
    coverImageKey: (data.cover_image_key as string | null) ?? null,
    coverImageAlt: (data.cover_image_alt as string | null) ?? null,
    coverImageStatus,
    seoTitle: (data.seo_title as string | null) ?? null,
    seoDescription: (data.seo_description as string | null) ?? null,
    category: data.categories as unknown as { id: string; name: string; slug: string },
    authorName: (data.authors as unknown as { name: string }).name,
    publishedAt: (data.published_at as string | null) ?? "",
    status: data.status as ArticleStatus,
    body: data.body as unknown as ArticlePreviewData["body"],
    likeCount: (data.like_count as number) ?? 0,
    commentCount: (data.comment_count as number) ?? 0,
    resolvedVideos,
    resolvedDocuments,
  };

  return { ok: true, data: article };
}
