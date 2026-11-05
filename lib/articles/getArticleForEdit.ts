import "server-only";
import { unstable_noStore } from "next/cache";
import { requireStaff } from "@/lib/auth/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type {
  GetArticleForEditResponse,
  ArticleEditData,
  ArticleStatus,
  ResolvedVideoNode,
  ResolvedDocumentNode,
  RefTargetStatus,
} from "@/types/article";

export async function getArticleForEdit(id: string): Promise<GetArticleForEditResponse> {
  unstable_noStore();

  const auth = await requireStaff("articles.*");
  if (!auth.ok) return { ok: false, code: "not_allowed" };

  const supabase = createSupabaseServiceRoleClient();

  const { data, error } = await supabase
    .from("articles")
    .select(
      `id, title, excerpt, slug, cover_image_key, cover_image_alt,
       author_id, category_id, published_at, status, body, body_version,
       seo_title, seo_description,
       article_refs(ref_type, ref_id, node_id, phrase, videos(status), documents:documents(status))`
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return { ok: false, code: "not_found" };

  // Look up cover image status from media_assets
  let coverImageStatus: "ready" | "pending" | "error" | null = null;
  const coverKey = data.cover_image_key as string | null;
  if (coverKey) {
    const { data: asset } = await supabase
      .from("media_assets")
      .select("status")
      .eq("file_key", coverKey)
      .maybeSingle();
    coverImageStatus = (asset?.status as "ready" | "pending" | "error" | null) ?? null;
  }

  const rawRefs = (data.article_refs ?? []) as Array<Record<string, unknown>>;

  const VALID_REF_STATUSES = new Set(["published", "hidden", "deleted", "not_found"]);

  const resolvedVideos: ResolvedVideoNode[] = rawRefs
    .filter((r) => r.ref_type === "video")
    .map((r) => {
      const videoRow = r.videos as { status?: string } | null;
      const raw = videoRow?.status;
      const status: RefTargetStatus =
        raw && VALID_REF_STATUSES.has(raw) ? (raw as RefTargetStatus) : "not_found";
      return { nodeId: r.node_id as string, videoId: r.ref_id as string, status };
    });

  const resolvedDocuments: ResolvedDocumentNode[] = rawRefs
    .filter((r) => r.ref_type === "document")
    .map((r) => {
      const docRow = r.documents as { status?: string } | null;
      const raw = docRow?.status;
      const status: RefTargetStatus =
        raw && VALID_REF_STATUSES.has(raw) ? (raw as RefTargetStatus) : "not_found";
      return { nodeId: r.node_id as string, documentId: r.ref_id as string, status };
    });

  const result: ArticleEditData = {
    id: data.id as string,
    title: data.title as string,
    excerpt: (data.excerpt as string | null) ?? null,
    slug: data.slug as string,
    coverImageKey: (data.cover_image_key as string | null) ?? null,
    coverImageAlt: (data.cover_image_alt as string | null) ?? null,
    coverImageStatus,
    authorId: data.author_id as string,
    categoryId: data.category_id as string,
    publishedAt: (data.published_at as string | null) ?? null,
    status: data.status as ArticleStatus,
    body: data.body as unknown as ArticleEditData["body"],
    bodyVersion: data.body_version as number,
    seoTitle: (data.seo_title as string | null) ?? null,
    seoDescription: (data.seo_description as string | null) ?? null,
    resolvedVideos,
    resolvedDocuments,
  };

  return { ok: true, data: result };
}
