"use client";
import { useState } from "react";
import Link from "next/link";
import { useArticleUserStatus } from "@/hooks/useArticleUserStatus";
import { t } from "@/messages/en";
import type { RateLimitReason } from "@/types/comment";

interface Props {
  articleId: string;
}

const DRAFT_KEY = (id: string) => `cs_comment_draft_${id}`;

export function CommentForm({ articleId }: Props) {
  const userStatus = useArticleUserStatus();
  const [body, setBody] = useState(() => {
    try { return sessionStorage.getItem(DRAFT_KEY(articleId)) ?? ""; } catch { return ""; }
  });
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function handleBodyChange(value: string) {
    setBody(value);
    try { sessionStorage.setItem(DRAFT_KEY(articleId), value); } catch {}
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSubmitted(false);
    setPending(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "article", id: articleId, text: body }),
      });
      if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        const reason: RateLimitReason = data.reason ?? "hourly";
        setErrorMsg(
          reason === "pending_cap"
            ? t("article.comment.rate_limited_pending_cap")
            : t("article.comment.rate_limited_hourly"),
        );
        setPending(false);
        return;
      }
      if (!res.ok) {
        setErrorMsg(t("article.comment.error"));
        setPending(false);
        return;
      }
      setBody("");
      try { sessionStorage.removeItem(DRAFT_KEY(articleId)); } catch {}
      setSubmitted(true);
    } catch {
      setErrorMsg(t("article.comment.error"));
    } finally {
      setPending(false);
    }
  }

  if (userStatus === "loading") return null;

  if (userStatus === "signed-out") {
    return (
      <p>
        <Link href="/sign-in">{t("article.comment.sign_in_to_comment")}</Link>
      </p>
    );
  }

  if (userStatus === "suspended") {
    return <p>{t("article.comment.suspended")}</p>;
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="comment-body">{t("article.comment.textarea_label")}</label>
      <textarea
        id="comment-body"
        value={body}
        onChange={(e) => handleBodyChange(e.target.value)}
        placeholder={t("article.comment.textarea_placeholder")}
        disabled={pending}
        aria-label={t("article.comment.textarea_label")}
        maxLength={2000}
      />
      <button type="submit" disabled={pending || !body.trim()}>
        {pending ? t("article.comment.submitting") : t("article.comment.submit")}
      </button>
      {submitted && <p role="status">{t("article.comment.pending")}</p>}
      {errorMsg && <p role="alert">{errorMsg}</p>}
    </form>
  );
}
