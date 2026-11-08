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
