import "server-only";

import { createSupabaseAnonClient, createSupabaseServerClient } from "@/lib/supabase/server";
import type { Comment, CommentListResult, MyCommentListResult } from "@/types/comment";
import { decodeCursor } from "@/lib/validation/comment";

const PAGE_SIZE = 10;

export async function listComments(
  articleId: string,
  cursor: string | null
): Promise<CommentListResult> {
  const supabase = createSupabaseAnonClient();

  let query = supabase
    .from("article_comments")
    .select(
      "id, body, created_at, public_profiles!inner(display_name, is_staff)"
    )
    .eq("article_id", articleId)
    .eq("status", "approved")
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (cursor) {
    const decoded = decodeCursor(cursor);
    // Composite cursor: (created_at, id) > (cursor.createdAt, cursor.id)
    // Using .or() to handle ties when multiple comments share the same timestamp.
    query = query.or(
      `created_at.gt.${decoded.createdAt},and(created_at.eq.${decoded.createdAt},id.gt.${decoded.id})`
    ) as typeof query;
  }

  type CommentRow = {
    id: string;
    body: string;
    created_at: string;
    public_profiles: { display_name: string; is_staff: boolean };
  };
  const { data, error } = await (query.limit(PAGE_SIZE + 1) as unknown as Promise<{
    data: CommentRow[] | null;
    error: { message: string } | null;
  }>);

  if (error || !data) {
    return { comments: [], nextCursor: null };
  }

  const hasMore = data.length > PAGE_SIZE;
  const rows = hasMore ? data.slice(0, PAGE_SIZE) : data;

  const comments: Comment[] = rows.map((row) => ({
    id: row.id,
    articleId,
    author: {
      displayName: row.public_profiles.display_name,
      isStaff: row.public_profiles.is_staff,
    },
    body: row.body,
    createdAt: row.created_at,
  }));

  const lastRow = rows[rows.length - 1];
  const nextCursor =
    hasMore && lastRow
      ? { createdAt: lastRow.created_at, id: lastRow.id }
      : null;

  return { comments, nextCursor };
}

export async function listMyComments(
  userId: string,
  articleId: string
): Promise<MyCommentListResult> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("article_comments")
    .select("id, body, status, created_at")
    .eq("article_id", articleId)
    .eq("user_id", userId)
    .in("status", ["pending", "rejected"])
    .order("created_at", { ascending: false });

  if (error || !data) {
    return { comments: [] };
  }

  return {
    comments: data.map((row) => ({
      id: row.id,
      body: row.body,
      status: row.status as "pending" | "rejected",
      createdAt: row.created_at,
    })),
  };
}
