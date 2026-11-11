"use client";
import { useEffect, useState } from "react";
import { useArticleUserStatus } from "@/hooks/useArticleUserStatus";
import { t } from "@/messages/en";
import type { Comment, CommentCursor, MyComment } from "@/types/comment";

interface Props {
  articleId: string;
  initialComments: Comment[];
  initialNextCursor: CommentCursor | null;
}

export function CommentThread({ articleId, initialComments, initialNextCursor }: Props) {
  const userStatus = useArticleUserStatus();
  const [pendingComment, setPendingComment] = useState<Pick<MyComment, "id" | "body"> | null>(null);
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [nextCursor, setNextCursor] = useState<CommentCursor | null>(initialNextCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);

  useEffect(() => {
    if (userStatus !== "active") return;
    fetch(`/api/comments?kind=article&id=${encodeURIComponent(articleId)}&mine=1`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.comments?.length) {
          const first = d.comments[0] as MyComment;
          setPendingComment({ id: first.id, body: first.body });
        }
      })
      .catch(() => {});
  }, [articleId, userStatus]);

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({
        kind: "article",
        id: articleId,
        cursor: JSON.stringify(nextCursor),
        pageSize: "10",
      });
      const res = await fetch(`/api/comments?${params}`);
      if (!res.ok) {
        setLoadMoreError(true);
        return;
      }
      setLoadMoreError(false);
      const data = await res.json();
      setComments((prev) => [...prev, ...(data.comments ?? [])]);
      setNextCursor(data.nextCursor ?? null);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <section aria-label="Comments">
      {userStatus === "active" && pendingComment && (
        <div>
          <p>{pendingComment.body}</p>
          <span>{t("article.comment.waiting_for_approval")}</span>
        </div>
      )}
      {comments.length === 0 ? (
        <p>
          {userStatus === "signed-out" || userStatus === "loading"
            ? t("article.comment.empty_signed_out")
            : t("article.comment.empty_signed_in")}
        </p>
      ) : (
        <ul>
          {comments.map((c) => (
            <li key={c.id}>
              <span>{c.author.displayName}</span>
              {c.author.isStaff && <span>{t("article.comment.staff_badge")}</span>}
              <p>{c.body}</p>
              <time dateTime={c.createdAt}>
                {new Date(c.createdAt).toLocaleDateString("en-LK")}
              </time>
            </li>
          ))}
        </ul>
      )}
      {loadMoreError && (
        <p role="alert">{t("article.comment.load_more.error")}</p>
      )}
      {nextCursor && (
        <button type="button" onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? t("article.comment.load_more.loading") : t("article.comment.load_more")}
        </button>
      )}
    </section>
  );
}
