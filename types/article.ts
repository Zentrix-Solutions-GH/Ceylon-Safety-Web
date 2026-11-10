export type ArticleStatus = "draft" | "published" | "hidden";

// ─── ArticleBody — structured JSON stored in articles.body ───────────────────

export interface ArticleBody {
  schema_version: number;
  type: "doc";
  content: ArticleNode[];
}

export type ArticleNode =
  | ParagraphNode
  | HeadingNode
  | BulletListNode
  | OrderedListNode
  | ListItemNode
  | HardBreakNode
  | ImageNode
  | VideoNode
  | DocumentSpotNode
  | CourseSpotNode
  | AdSlotNode;

export interface ParagraphNode {
  type: "paragraph";
  content?: InlineNode[];
}

export interface HeadingNode {
  type: "heading";
  attrs: { level: 1 | 2 | 3 | 4; style?: "title" | "sub-topic" };
  content?: InlineNode[];
}

export interface BulletListNode {
  type: "bulletList";
  content: ListItemNode[];
}

export interface OrderedListNode {
  type: "orderedList";
  content: ListItemNode[];
}

export interface ListItemNode {
  type: "listItem";
  content: (ParagraphNode | BulletListNode | OrderedListNode)[];
}

export interface HardBreakNode {
  type: "hardBreak";
}

export interface ImageNode {
  type: "image";
  attrs: {
    node_id: string;
    key: string;
    alt?: string;
    decorative?: boolean;
    caption?: string;
  };
}

export interface VideoNode {
  type: "video";
  attrs: { node_id: string; video_id: string };
}

export interface DocumentSpotNode {
  type: "document_spot";
  attrs: { node_id: string; document_id: string };
}

export interface CourseSpotNode {
  type: "course_spot";
  attrs: { node_id: string; course_id: string };
}

export interface AdSlotNode {
  type: "ad_slot";
  attrs: { node_id: string; ad_type: "google" };
}

export interface InlineNode {
  type: "text";
  text: string;
  marks?: Mark[];
}

export type Mark =
  | { type: "bold" }
  | { type: "italic" }
  | { type: "underline" }
  | { type: "link"; attrs: { href: string } }
  | { type: "namedStyle"; attrs: { style: "title" | "sub-topic" | "paragraph" | "other" } }
  | { type: "namedFont"; attrs: { font: string } };

// ─── saveArticle ─────────────────────────────────────────────────────────────

export interface SaveArticleInput {
  /** Omit to create a new draft */
  articleId?: string;
  title: string;
  /** Up to 300 characters */
  excerpt?: string;
  /** Override auto-generated slug (editable until first publish) */
  slug?: string;
  coverImageKey?: string;
  coverImageAlt?: string;
  authorId: string;
  categoryId: string;
  publishedAt?: string;
  body: ArticleBody | Record<string, unknown>;
  /** Current body_version the editor loaded (for version check) */
  bodyVersion: number;
  seoTitle?: string;
  seoDescription?: string;
}

export type SaveArticleResult =
  | { ok: true; articleId: string; bodyVersion: number; slug: string }
  | { ok: false; code: "not_allowed" | "validation_failed" | "version_conflict" | "not_found" | "purge_failed" | "refs_inconsistent" | "unknown"; reason?: string };

// ─── setArticleStatus ────────────────────────────────────────────────────────

export interface SetArticleStatusInput {
  articleId: string;
  action: "publish" | "hide" | "delete";
  /** Required for publish */
  publishedAt?: string;
}

export interface MissingPublishItem {
  field: string;
  label: string;
}

export type SetArticleStatusResult =
  | { ok: true }
  | { ok: false; code: "not_allowed" | "validation_failed" | "not_found" | "purge_failed" | "unknown"; missing?: MissingPublishItem[]; reason?: string };

// ─── Read types (S-049) ──────────────────────────────────────────────────────

export type ArticleRange = "newest" | "week" | "month";

export interface Category {
  id: string;
  name: string;
  slug: string;
}

/** Cursor for keyset pagination on (published_at DESC, id ASC). */
export interface ArticleCursor {
  publishedAt: string; // ISO 8601
  id: string;
}

/** One card in the public articles list. */
export interface ArticleCard {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  coverImageKey: string | null;
  coverImageAlt: string | null;
  category: Category;
  authorName: string;
  publishedAt: string;
  likeCount: number;
  commentCount: number; // approved comments only
}

export interface ArticleListResult {
  items: ArticleCard[];
  /** null when no more pages */
  next: ArticleCursor | null;
}

export type ArticleListInput = {
  range?: ArticleRange;
  category?: string; // category slug
  cursor?: ArticleCursor;
};

export type ArticleListResponse =
  | { ok: true; data: ArticleListResult }
  | { ok: false; code: "validation_failed"; reason: string }
  | { ok: false; code: "unknown" };

/** Resolved node status for editor dead-card warnings. */
export type RefTargetStatus = "published" | "hidden" | "deleted" | "not_found";

export interface ResolvedVideoNode {
  nodeId: string;
  videoId: string;
  status: RefTargetStatus;
}

export interface ResolvedDocumentNode {
  nodeId: string;
  documentId: string;
  /** Always "not_shown" until S-071/S-077 resolve the docs backend. */
  status: "not_shown" | RefTargetStatus;
}

/** Full public article for the article page. */
export interface PublicArticle {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  coverImageKey: string | null;
  coverImageAlt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  category: Category;
  authorName: string;
  publishedAt: string;
  body: ArticleBody;
  likeCount: number;
  commentCount: number;
  resolvedVideos: ResolvedVideoNode[];
  resolvedDocuments: ResolvedDocumentNode[];
}

export type GetArticleResponse =
  | { ok: true; data: PublicArticle }
  | { ok: false; code: "not_found" }
  | { ok: false; code: "redirect"; newSlug: string };

export interface ArticlePreviewData extends PublicArticle {
  status: ArticleStatus;
  /** Media asset status of the cover image; null if no cover set. */
  coverImageStatus: string | null;
}

export type GetArticlePreviewResponse =
  | { ok: true; data: ArticlePreviewData }
  | { ok: false; code: "not_allowed" | "not_found" };

/** Data returned to the article editor. */
export interface ArticleEditData {
  id: string;
  title: string;
  excerpt: string | null;
  slug: string;
  coverImageKey: string | null;
  coverImageAlt: string | null;
  coverImageStatus: "ready" | "pending" | "error" | null;
  authorId: string;
  categoryId: string;
  publishedAt: string | null;
  status: ArticleStatus;
  body: ArticleBody;
  bodyVersion: number;
  seoTitle: string | null;
  seoDescription: string | null;
  resolvedVideos: ResolvedVideoNode[];
  resolvedDocuments: ResolvedDocumentNode[];
}

export type GetArticleForEditResponse =
  | { ok: true; data: ArticleEditData }
  | { ok: false; code: "not_allowed" | "not_found" };

/** One row in the admin articles list. */
export interface AdminArticleRow {
  id: string;
  slug: string;
  title: string;
  status: ArticleStatus | "scheduled";
  categorySlug: string;
  categoryName: string;
  authorName: string;
  updatedAt: string;
}

export interface AdminArticleListResult {
  items: AdminArticleRow[];
  pageCount: number;
}

export type AdminArticleListInput = {
  status?: ArticleStatus | "scheduled";
  category?: string; // category slug
  title?: string; // substring search
  page?: number;
};

export type AdminArticleListResponse =
  | { ok: true; data: AdminArticleListResult }
  | { ok: false; code: "not_allowed" | "unknown" };
