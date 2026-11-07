"use client";

import { useState, useTransition } from "react";
import { ArticleCardUI } from "@/components/articles/ArticleCard";
import { t } from "@/messages/en";
import type { ArticleCard, ArticleCursor } from "@/types/article";

const MEDIA_BASE = process.env.NEXT_PUBLIC_PUBLIC_MEDIA_BASE_URL ?? "";

function coverUrl(key: string | null): string | undefined {
  if (!key) return undefined;
  return `${MEDIA_BASE}/${key}`;
}

interface ArticleGridProps {
  initialItems: ArticleCard[];
  initialNext: ArticleCursor | null;
  range?: string;
  category?: string;
}

export function ArticleGrid({
  initialItems,
  initialNext,
  range,
  category,
}: ArticleGridProps) {
  const [items, setItems] = useState<ArticleCard[]>(initialItems);
  const [next, setNext] = useState<ArticleCursor | null>(initialNext);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function loadMore() {
    if (!next || isPending) return;
    setError(null);
    startTransition(async () => {
      try {
        const params = new URLSearchParams();
        if (range && range !== "newest") params.set("range", range);
        if (category) params.set("category", category);
        params.set("cursor", JSON.stringify(next));
        const res = await fetch(`/api/articles?${params.toString()}`);
        if (!res.ok) throw new Error("fetch failed");
        const data = await res.json();
        setItems((prev) => [...prev, ...data.items]);
        setNext(data.next ?? null);
      } catch {
        setError(t("articles.load_more.error"));
      }
    });
  }

  return (
    <div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <ArticleCardUI
            key={item.id}
            slug={item.slug}
            title={item.title}
            excerpt={item.excerpt}
            coverUrl={coverUrl(item.coverImageKey)}
            coverAlt={item.coverImageAlt ?? undefined}
            categoryName={item.category.name}
            authorName={item.authorName}
            publishedAt={item.publishedAt}
            likeCount={item.likeCount}
            commentCount={item.commentCount}
          />
        ))}
      </div>

      {error && (
        <div className="mt-6 flex items-center gap-3 text-sm text-red-600">
          <span>{error}</span>
          <button
            type="button"
            onClick={loadMore}
            className="underline"
          >
            {t("articles.load_more.retry")}
          </button>
        </div>
      )}

      {next && !error && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={isPending}
            className="rounded bg-red-600 px-6 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isPending ? t("articles.load_more.loading") : t("articles.load_more")}
          </button>
        </div>
      )}
    </div>
  );
}
