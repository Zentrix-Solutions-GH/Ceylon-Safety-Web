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
  | { ok: false; code: "not_allowed" | "validation_failed" | "version_conflict" | "not_found" | "unknown"; reason?: string };

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
