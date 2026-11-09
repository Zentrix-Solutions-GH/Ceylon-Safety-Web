// Backend-owned. Defined here as a scaffold until backend fills in error codes.
// Shape: auth design §17 (M19).

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; code: string; reason?: string; field?: string };

// Runtime list used by messages/__tests__/errors.test.ts to verify coverage.
export const COMMON_ERROR_CODES = [
  "validation_failed",
  "not_allowed",
  "not_found",
  "rate_limited",
  "version_conflict",
  "upload_failed",
  "purge_failed",
  "reauth_required",
  "mfa_required",
  "unknown",
] as const;

export type CommonErrorCode = (typeof COMMON_ERROR_CODES)[number];

// ── Search (S-064) ─────────────────────────────────────────────────────────

export type SearchScope = "home" | "articles" | "documents";

export interface SearchResultItem {
  kind: "article" | "document";
  id: string;
  slug: string;
  title: string;
  shortText: string;
  coverImageKey: string | null;
  categoryName: string | null;
}

export type SearchResponse = ActionResult<SearchResultItem[]>;

// ── Feed (S-065) ────────────────────────────────────────────────────────────

interface FeedItemBase {
  kind: "article" | "video";
  id: string;
  slug: string | null;
  title: string;
  coverImageKey: string | null;
  categoryId: string | null;
  publishedAt: string;
  likeCount: number;
  commentCount: number;
}

export interface ArticleFeedItem extends FeedItemBase {
  kind: "article";
  excerpt: string | null;
  authorName: string | null;
}

export interface VideoFeedItem extends FeedItemBase {
  kind: "video";
}

export type FeedItem = ArticleFeedItem | VideoFeedItem;

export interface FeedPage {
  items: FeedItem[];
  nextCursor: string | null;
}

// ── Counters (S-065) ────────────────────────────────────────────────────────

export interface Counters {
  articles: number | null;
  documents: number | null;
  users: number | null;
  downloads: number | null;
}

// S-045: stub until S-101 ships the Today-list API and fills real counts.
export interface AdminBadgeCounts {
  comments: number;
  bankTransfers: number;
  downloadRequests: number;
}
