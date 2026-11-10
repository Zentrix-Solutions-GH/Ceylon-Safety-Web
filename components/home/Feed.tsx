"use client";

import { useState, useCallback, useRef } from "react";

const MEDIA_BASE = process.env.NEXT_PUBLIC_PUBLIC_MEDIA_BASE_URL ?? "";
import { t } from "@/messages/en";
import { ArticleCardUI } from "@/components/articles/ArticleCard";
import { VideoCard } from "@/components/home/VideoCard";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import type { FeedItem, FeedPage } from "@/types/api";

interface FeedProps {
  firstPage: FeedPage;
  autoLoadUntilPage: number;
}

function CardSkeleton() {
  return (
    <div
      className="flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
      aria-hidden="true"
    >
      <div className="aspect-video bg-gray-200 animate-pulse motion-reduce:animate-none" />
      <div className="flex flex-col gap-2 p-4">
        <div className="h-3 w-1/3 rounded bg-gray-200 animate-pulse motion-reduce:animate-none" />
        <div className="h-4 w-full rounded bg-gray-200 animate-pulse motion-reduce:animate-none" />
        <div className="h-4 w-5/6 rounded bg-gray-200 animate-pulse motion-reduce:animate-none" />
      </div>
    </div>
  );
}

function FeedCard({ item }: { item: FeedItem }) {
  if (item.kind === "video") {
    return <VideoCard item={item} />;
  }
  if (!item.slug) return null;
  return (
    <ArticleCardUI
      slug={item.slug}
      title={item.title}
      excerpt={item.excerpt}
      coverUrl={item.coverImageKey ? `${MEDIA_BASE}/${item.coverImageKey}` : undefined}
      authorName={item.authorName ?? ""}
      publishedAt={item.publishedAt}
      likeCount={item.likeCount}
      commentCount={item.commentCount}
    />
  );
}

export function Feed({ firstPage, autoLoadUntilPage }: FeedProps) {
  const [items, setItems] = useState<FeedItem[]>(firstPage.items);
  const [cursor, setCursor] = useState<string | null>(firstPage.nextCursor);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  // Keep a ref in sync with cursor so loadMore is stable (no cursor dep → no observer cascade)
  const cursorRef = useRef<string | null>(firstPage.nextCursor);
  cursorRef.current = cursor;
  const loadingGuard = useRef(false);

  const loadMore = useCallback(async () => {
    if (!cursorRef.current || loadingGuard.current) return;
    loadingGuard.current = true;
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/feed?cursor=${encodeURIComponent(cursorRef.current)}`);
      const json = await res.json() as { ok: boolean; data?: FeedPage };
      if (!json.ok || !json.data) {
        setError(true);
        return;
      }
      setItems((prev) => [...prev, ...json.data!.items]);
      setCursor(json.data.nextCursor);
      setPage((p) => p + 1);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      loadingGuard.current = false;
    }
  }, []);

  const { ref: sentinelRef } = useInfiniteScroll({
    page,
    autoLoadUntilPage,
    hasMore: !!cursor,
    onLoad: loadMore,
  });

  const showLoadMore = !!cursor && page >= autoLoadUntilPage && !loading;

  if (items.length === 0) {
    return (
      <p className="py-16 text-center text-gray-500">
        {t("articles.empty.all")}
      </p>
    );
  }

  return (
    <section aria-label={t("home.feed_label")}>
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" role="list">
        {items.map((item) => (
          <li key={item.id}>
            <FeedCard item={item} />
          </li>
        ))}
        {loading && (
          <>
            <li><CardSkeleton /></li>
            <li><CardSkeleton /></li>
            <li><CardSkeleton /></li>
          </>
        )}
      </ul>

      {!!cursor && page < autoLoadUntilPage && (
        <div ref={sentinelRef} aria-hidden="true" className="h-1" />
      )}

      {error && (
        <div className="mt-6 flex flex-col items-center gap-3">
          <p className="text-sm text-red-600">{t("articles.load_more.error")}</p>
          <button
            type="button"
            onClick={() => void loadMore()}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            {t("articles.load_more.retry")}
          </button>
        </div>
      )}

      {showLoadMore && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => void loadMore()}
            className="rounded-md bg-red-600 px-6 py-2 text-sm font-semibold text-white hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-600"
          >
            {t("articles.load_more")}
          </button>
        </div>
      )}
    </section>
  );
}
