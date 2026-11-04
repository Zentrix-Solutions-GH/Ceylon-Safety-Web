import "server-only";
import { revalidateTag } from "next/cache";
import { writeAuditRow } from "@/lib/audit/index";
import type { AuditEventName } from "@/types/audit";

export type PurgeEvent = "publish" | "hide" | "delete" | "slug_change" | "author_change" | "category_change";

type PurgeResult = { ok: true } | { ok: false; code: "purge_failed" };

// Tags to clear for every article-level purge event (content design section 15).
function articleTags(articleId: string): string[] {
  return [
    `article:${articleId}`,
    "articles-list",
    "home-first-page",
    "feed-api",
    "counters",
    "sitemap",
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
