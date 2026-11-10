import "server-only";
import { revalidateTag } from "next/cache";
import { writeAuditRow } from "@/lib/audit/index";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { AuditEventName } from "@/types/audit";
import {
  FEED_TAG,
  HOME_FIRST_PAGE_TAG,
  COUNTERS_TAG,
  SITEMAP_TAG,
  ARTICLES_LIST_TAG,
  DOCUMENTS_LIST_TAG,
  documentTag,
} from "@/lib/cache/tags";

export type PurgeEvent = "publish" | "hide" | "delete" | "slug_change" | "author_change" | "category_change";

type PurgeResult = { ok: true } | { ok: false; code: "purge_failed" };

// Tags to clear for every article-level purge event (content design section 15).
function articleTags(articleId: string): string[] {
  return [
    `article:${articleId}`,
    ARTICLES_LIST_TAG,
    HOME_FIRST_PAGE_TAG,
    FEED_TAG,
    COUNTERS_TAG,
    SITEMAP_TAG,
  ];
}

function purgeTagSubset(tags: string[]): string[] {
  const failed: string[] = [];
  for (const tag of tags) {
    try { revalidateTag(tag); } catch { failed.push(tag); }
  }
  return failed;
}

/**
 * Clear cached pages for an article event.
 * Retries only failed tags once. If still failing, writes purge.failed audit row.
 */
export async function purgeArticle(
  articleId: string,
  event: PurgeEvent,
  actorId?: string
): Promise<PurgeResult> {
  const tags = articleTags(articleId);

  let failed = purgeTagSubset(tags);
  if (failed.length === 0) return { ok: true };

  // One retry — only the tags that failed
  failed = purgeTagSubset(failed);
  if (failed.length === 0) return { ok: true };

  try {
    await writeAuditRow({
      action: "purge.failed" as AuditEventName,
      actorId: actorId ?? "system",
      entityType: "article",
      entityId: articleId,
      after: { event },
    });
  } catch {} // audit failure must not mask the purge result
  return { ok: false, code: "purge_failed" };
}

/**
 * Clear cached pages for a video hide or delete event (content design section 15).
 * Clears: home-first-page, feed-api, counters, and every article that uses this video.
 */
export async function purgeVideo(
  videoId: string,
  actorId?: string
): Promise<PurgeResult> {
  // Find articles that reference this video through article_refs
  const supabase = createSupabaseServiceRoleClient();
  const { data: refs, error: refsError } = await supabase
    .from("article_refs")
    .select("article_id")
    .eq("ref_type", "video")
    .eq("ref_id", videoId);

  // If the lookup fails we cannot purge article caches — treat as purge_failed
  if (refsError) {
    try {
      await writeAuditRow({
        action: "purge.failed" as AuditEventName,
        actorId: actorId ?? "system",
        entityType: "video",
        entityId: videoId,
        after: { event: "article-refs-lookup-failed", error: refsError.message },
      });
    } catch {}
    return { ok: false, code: "purge_failed" };
  }

  const articleIds: string[] = (refs ?? []).map((r: { article_id: string }) => r.article_id);

  const tags = [
    HOME_FIRST_PAGE_TAG,
    FEED_TAG,
    COUNTERS_TAG,
    ...articleIds.map(id => `article:${id}`),
  ];

  let failed = purgeTagSubset(tags);
  if (failed.length === 0) return { ok: true };

  failed = purgeTagSubset(failed);
  if (failed.length === 0) return { ok: true };

  try {
    await writeAuditRow({
      action: "purge.failed" as AuditEventName,
      actorId: actorId ?? "system",
      entityType: "video",
      entityId: videoId,
      after: { event: "video-status-change" },
    });
  } catch {}
  return { ok: false, code: "purge_failed" };
}

/**
 * Clear cached pages for a document publish or hide event (content design section 15).
 * Clears: that document page, documents list, counters, sitemap, every article using the document.
 */
export async function purgeDocument(
  documentId: string,
  articleIds: string[],
  actorId?: string,
): Promise<{ ok: true } | { ok: false; code: "purge_failed" }> {
  const tags = [
    DOCUMENTS_LIST_TAG,
    COUNTERS_TAG,
    SITEMAP_TAG,
    documentTag(documentId),
    ...articleIds.map((id) => `article:${id}`),
  ];

  let failed = purgeTagSubset(tags);
  if (failed.length === 0) return { ok: true };

  failed = purgeTagSubset(failed);
  if (failed.length === 0) return { ok: true };

  try {
    await writeAuditRow({
      action: "purge.failed" as AuditEventName,
      actorId: actorId ?? "system",
      entityType: "document",
      entityId: documentId,
      after: { failedTags: failed },
    });
  } catch {}
  return { ok: false, code: "purge_failed" };
}
