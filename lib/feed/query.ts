import "server-only";
import { unstable_cache } from "next/cache";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/ratelimit";
import { serverConfig } from "@/lib/config";
import { FEED_TAG, HOME_FIRST_PAGE_TAG } from "@/lib/cache/tags";
import type { FeedItem, FeedPage, ArticleFeedItem, VideoFeedItem } from "@/types/api";
import type { GetPublicVideoResult } from "@/types/video";

export const PAGE_SIZE = 12;

const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/;

// ---------------------------------------------------------------------------
// Cursor
// ---------------------------------------------------------------------------

type ParseCursorOk = { ok: true; publishedAt: string; id: string };
type ParseCursorFail = { ok: false; code: "validation_failed" };

export function encodeCursor(publishedAt: string, id: string): string {
  return Buffer.from(JSON.stringify({ t: publishedAt, i: id })).toString("base64url");
}

export function parseCursor(raw: string | undefined): ParseCursorOk | ParseCursorFail {
  if (!raw) return { ok: false, code: "validation_failed" };
  try {
    const decoded = JSON.parse(Buffer.from(raw, "base64url").toString("utf-8"));
    const t = decoded?.t;
    const i = decoded?.i;
    if (typeof t !== "string" || typeof i !== "string") return { ok: false, code: "validation_failed" };
    // Validate ISO timestamp
    const d = new Date(t);
    if (isNaN(d.getTime())) return { ok: false, code: "validation_failed" };
    // Validate UUID
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(i)) {
      return { ok: false, code: "validation_failed" };
    }
    return { ok: true, publishedAt: t, id: i };
  } catch {
    return { ok: false, code: "validation_failed" };
  }
}

// ---------------------------------------------------------------------------
// Row → FeedItem shape
// ---------------------------------------------------------------------------

type FeedRow = {
  kind: string | null;
  id: string | null;
  title: string | null;
  summary: string | null;
  image: string | null;
  category_id: string | null;
  published_at: string | null;
  like_count: number | null;
  comment_count: number | null;
  status: string | null;
  deleted_at: string | null;
  locale: string | null;
  slug?: string | null;
  author_name?: string | null;
  [key: string]: unknown;
};

export function toFeedItem(row: FeedRow): FeedItem {
  const base = {
    id: row.id ?? "",
    slug: row.slug ?? null,
    title: row.title ?? "",
    coverImageKey: row.image ?? null,
    categoryId: row.category_id ?? null,
    publishedAt: row.published_at ?? "",
    likeCount: row.like_count ?? 0,
    commentCount: row.comment_count ?? 0,
  };

  if (row.kind === "article") {
    return {
      ...base,
      kind: "article",
      excerpt: row.summary ?? null,
      authorName: row.author_name ?? null,
    } as ArticleFeedItem;
  }

  return { ...base, kind: "video" } as VideoFeedItem;
}

// ---------------------------------------------------------------------------
// Feed query
// ---------------------------------------------------------------------------

type GetFeedResult =
  | { ok: true; page: FeedPage }
  | { ok: false; code: "validation_failed" | "unknown" };

async function queryFeed(cursor?: string): Promise<GetFeedResult> {
  const supabase = createSupabaseServiceRoleClient();

  const now = new Date().toISOString();

  // Base query on feed_items view — articles + videos together
  // The view does not expose slug or author_name; we join articles table for those.
  // We use a raw query approach: select from view, then enrich article rows.
  let query = supabase
    .from("feed_items")
    .select("kind, id, title, summary, image, category_id, published_at, like_count, comment_count, status, deleted_at, locale")
    .eq("status", "published")
    .lte("published_at", now)
    .is("deleted_at", null)
    .order("published_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PAGE_SIZE + 1);

  if (cursor) {
    const parsed = parseCursor(cursor);
    if (!parsed.ok) return { ok: false, code: "validation_failed" };
    // Keyset: (published_at, id) < (cursor.publishedAt, cursor.id)
    query = query.or(
      `published_at.lt.${parsed.publishedAt},and(published_at.eq.${parsed.publishedAt},id.lt.${parsed.id})`
    );
  }

  const { data, error } = await query;
  if (error || !data) return { ok: false, code: "unknown" };

  const hasMore = data.length > PAGE_SIZE;
  const rows = hasMore ? data.slice(0, PAGE_SIZE) : data;

  // Enrich article rows with slug + author_name via join
  const articleIds = rows.filter((r) => r.kind === "article").map((r) => r.id).filter(Boolean) as string[];
  const enrichMap: Record<string, { slug: string | null; author_name: string | null }> = {};

  if (articleIds.length > 0) {
    const { data: articles } = await supabase
      .from("articles")
      .select("id, slug, authors(display_name)")
      .in("id", articleIds);

    for (const a of articles ?? []) {
      const authorName = Array.isArray(a.authors)
        ? (a.authors[0] as { display_name: string } | undefined)?.display_name ?? null
        : (a.authors as { display_name: string } | null)?.display_name ?? null;
      enrichMap[a.id] = { slug: a.slug ?? null, author_name: authorName };
    }
  }

  const items: FeedItem[] = rows.map((row) => {
    const enrich = row.id ? enrichMap[row.id] ?? {} : {};
    return toFeedItem({ ...row, ...enrich });
  });

  const lastRow = rows[rows.length - 1];
  const nextCursor =
    hasMore && lastRow?.published_at && lastRow?.id
      ? encodeCursor(lastRow.published_at, lastRow.id)
      : null;

  return { ok: true, page: { items, nextCursor } };
}

const fetchFirstPage = unstable_cache(
  () => queryFeed(undefined),
  ["feed-first-page"],
  { revalidate: 60, tags: [FEED_TAG, HOME_FIRST_PAGE_TAG] }
);

export async function getFeed(cursor?: string): Promise<GetFeedResult> {
  if (!cursor) return fetchFirstPage();
  return queryFeed(cursor);
}

// ---------------------------------------------------------------------------
// Single video read
// ---------------------------------------------------------------------------

export function validateYoutubeId(id: string): boolean {
  return YOUTUBE_ID_RE.test(id);
}

const fetchVideo = (videoId: string) =>
  unstable_cache(
    async (): Promise<GetPublicVideoResult> => {
      const supabase = createSupabaseServiceRoleClient();
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from("videos")
        .select("id, youtube_id, title, description, thumbnail_key, category_id")
        .eq("id", videoId)
        .eq("status", "published")
        .lte("published_at", now)
        .is("deleted_at", null)
        .single();

      if (error || !data) return { ok: false, code: "not_found" };

      if (!validateYoutubeId(data.youtube_id)) return { ok: false, code: "not_found" };

      return {
        ok: true,
        video: {
          id: data.id,
          youtubeId: data.youtube_id,
          title: data.title,
          description: data.description ?? null,
          thumbnailKey: data.thumbnail_key,
          categoryId: data.category_id ?? "",
        },
      };
    },
    [`video-public-${videoId}`],
    { revalidate: 60, tags: [`video:${videoId}`] }
  )();

export async function getPublishedVideo(videoId: string): Promise<GetPublicVideoResult> {
  return fetchVideo(videoId);
}

// ---------------------------------------------------------------------------
// Rate limits
// ---------------------------------------------------------------------------

type RateLimitCheckResult = { ok: true } | { ok: false; code: "rate_limited" };

export async function applyFeedRateLimit(ip: string): Promise<RateLimitCheckResult> {
  const result = await checkRateLimit({
    limitName: "feed",
    key: ip,
    maxCount: serverConfig.feedRateLimitPerMinute,
    windowSeconds: 60,
    mode: "open",
  });
  if (!result.ok) return { ok: false, code: "rate_limited" };
  return { ok: true };
}

export async function applyCountersRateLimit(ip: string): Promise<RateLimitCheckResult> {
  const result = await checkRateLimit({
    limitName: "counters",
    key: ip,
    maxCount: serverConfig.countersRateLimitPerMinute,
    windowSeconds: 60,
    mode: "open",
  });
  if (!result.ok) return { ok: false, code: "rate_limited" };
  return { ok: true };
}
