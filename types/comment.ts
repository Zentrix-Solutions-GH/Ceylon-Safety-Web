// S-050: Article likes + comments backend contract.
// Backend defines; frontend consumes (S-061).

export type RateLimitReason = "hourly" | "pending_cap";

export type CommentStatus = "pending" | "approved" | "rejected";

export interface Comment {
  id: string;
  articleId: string;
  author: {
    displayName: string;
    isStaff: boolean;
  };
  body: string;
  createdAt: string;
}

export interface MyComment {
  id: string;
  body: string;
  status: "pending" | "rejected";
  createdAt: string;
}

export interface CommentCursor {
  createdAt: string;
  id: string;
}

export interface CommentListResult {
  comments: Comment[];
  nextCursor: CommentCursor | null;
}

export interface MyCommentListResult {
  comments: MyComment[];
}

export interface PostCommentInput {
  kind: "article";
  id: string;
  text: string;
}

export interface PostCommentResult {
  id: string;
}

export interface LikeResult {
  liked: boolean;
  count: number;
}

export interface LikeStatusResult {
  liked: boolean | null;
  count: number;
}

// S-061 contract aliases (content system design section 10.2)
export type PublicComment = Comment;
export type PendingComment = Pick<MyComment, "id" | "body"> & { status: "pending" };

// S-051: Comment moderation types (backend defines; frontend consumes in S-062)

export type ModerationState = "pending" | "approved" | "rejected" | "deleted";

// Subset of ModerationState that the list endpoint accepts; "deleted" is not listable.
export type ListableCommentState = "pending" | "approved" | "rejected";

export type ModerateAction = "approve" | "reject" | "delete" | "restore";

export interface ModerationRow {
  id: string;
  body: string;
  status: ListableCommentState;
  writerDisplayName: string;
  writerSuspended: boolean;
  articleTitle: string;
  articleSlug: string;
  createdAt: string;
  moderatorName: string | null;
  moderatedAt: string | null;
}

export interface ModerationListResult {
  comments: ModerationRow[];
  nextCursor: { createdAt: string; id: string } | null;
}

export interface ModerateCommentInput {
  commentId: string;
  action: ModerateAction;
}

export type ModerateCommentResult =
  | { ok: true }
  | { ok: false; code: "not_allowed" | "not_found" | "rate_limited" | "validation_failed" | "purge_failed" | "unknown"; reason?: string };

export interface BulkRejectResult {
  ok: true;
  rejected: string[];
  skipped: string[];
}
