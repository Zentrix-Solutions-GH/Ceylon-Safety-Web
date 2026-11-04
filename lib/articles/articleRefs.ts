// Build the article_refs rows from the article body and cover image key.
// Called inside the saveArticle transaction (delete + re-insert in one go).

import { extractRefs, type BodyRef } from "@/lib/content/schema";

export interface ArticleRefRow {
  node_id: string;
  ref_type: "document" | "course" | "video" | "media";
  ref_id: string;
}

/**
 * Build the full set of article_refs rows for one article save.
 * Includes body refs (video, document_spot, course_spot, image nodes)
 * and the cover image (node_id = "cover", ref_type = "media").
 */
export function buildArticleRefs(
  body: unknown,
  coverImageKey: string | null
): ArticleRefRow[] {
  const b = body as Record<string, unknown>;
  const content = Array.isArray(b?.content) ? (b.content as unknown[]) : [];
  const bodyRefs: BodyRef[] = extractRefs(content);

  const rows: ArticleRefRow[] = bodyRefs.map(ref => ({
    node_id: ref.node_id,
    ref_type: ref.ref_type,
    ref_id: ref.ref_id,
  }));

  if (coverImageKey) {
    rows.push({ node_id: "cover", ref_type: "media", ref_id: coverImageKey });
  }

  return rows;
}
