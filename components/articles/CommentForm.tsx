"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { t } from "@/messages/en";
import type { RateLimitReason } from "@/types/comment";

interface Props {
  articleId: string;
}
type UserStatus = "loading" | "signed-out" | "active" | "suspended";

const DRAFT_KEY = (id: string) => `cs_comment_draft_${id}`;

export function CommentForm({ articleId }: Props) {
  const [userStatus, setUserStatus] = useState<UserStatus>("loading");
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
      if (!user) { setUserStatus("signed-out"); return; }
      const status = (user.user_metadata?.account_status as string | undefined) ?? "active";
      setUserStatus(status === "suspended" ? "suspended" : "active");
      try {
        const draft = sessionStorage.getItem(DRAFT_KEY(articleId));
        if (draft) setBody(draft);
      } catch {}
    });
  }, [articleId]);

  function handleBodyChange(value: string) {
    setBody(value);
    try { sessionStorage.setItem(DRAFT_KEY(articleId), value); } catch {}
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
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
        ref={textareaRef}
        value={body}
        onChange={(e) => handleBodyChange(e.target.value)}
        placeholder={t("article.comment.textarea_placeholder")}
        disabled={pending}
        aria-label={t("article.comment.textarea_label")}
      />
      <button type="submit" disabled={pending || !body.trim()}>
        {pending ? t("article.comment.submitting") : t("article.comment.submit")}
      </button>
      {submitted && <p role="status">{t("article.comment.pending")}</p>}
      {errorMsg && <p role="alert">{errorMsg}</p>}
    </form>
  );
}
