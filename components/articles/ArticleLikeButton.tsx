"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { t } from "@/messages/en";

interface Props {
  articleId: string;
  slug: string;
  initialCount: number;
}
type UserStatus = "loading" | "signed-out" | "active" | "suspended";

export function ArticleLikeButton({ articleId, slug, initialCount }: Props) {
  const router = useRouter();
  const [userStatus, setUserStatus] = useState<UserStatus>("loading");
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
      if (!user) { setUserStatus("signed-out"); return; }
      const status = (user.user_metadata?.account_status as string | undefined) ?? "active";
      setUserStatus(status === "suspended" ? "suspended" : "active");
      fetch(`/api/likes?kind=article&id=${encodeURIComponent(articleId)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d) { setLiked(d.liked ?? false); setCount(d.count); } })
        .catch(() => {});
    });
  }, [articleId]);

  async function handleClick() {
    if (userStatus === "signed-out" || userStatus === "loading") {
      router.push(`/sign-in?next=/articles/${slug}`);
      return;
    }
    const prevLiked = liked;
    const prevCount = count;
    const nextLiked = !liked;
    setLiked(nextLiked);
    setCount((c) => (nextLiked ? c + 1 : c - 1));
    setErrorMsg(null);
    try {
      const res = await fetch("/api/likes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "article", id: articleId }),
      });
      if (!res.ok) {
        setLiked(prevLiked);
        setCount(prevCount);
        setErrorMsg(t("article.like.error"));
        return;
      }
      const data: { liked: boolean; count: number } = await res.json();
      setLiked(data.liked);
      setCount(data.count);
    } catch {
      setLiked(prevLiked);
      setCount(prevCount);
      setErrorMsg(t("article.like.error"));
    }
  }

  const label = liked ? t("article.like.liked_label") : t("article.like.button_label");
  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        aria-pressed={liked}
        aria-label={label}
        disabled={userStatus === "loading"}
      >
        {liked ? "♥" : "♡"} <span>{count}</span>
      </button>
      {errorMsg && <div role="alert">{errorMsg}</div>}
    </div>
  );
}
