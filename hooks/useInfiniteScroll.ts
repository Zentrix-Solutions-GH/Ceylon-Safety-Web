"use client";

import { useRef, useEffect, useCallback } from "react";

export interface UseInfiniteScrollOptions {
  page: number;
  autoLoadUntilPage: number;
  hasMore: boolean;
  onLoad: () => Promise<void>;
}

interface UseInfiniteScrollResult {
  ref: React.RefObject<HTMLDivElement>;
}

export function useInfiniteScroll({
  page,
  autoLoadUntilPage,
  hasMore,
  onLoad,
}: UseInfiniteScrollOptions): UseInfiniteScrollResult {
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Keep refs in sync each render so tryLoad can use current values without
  // being re-created — a stable tryLoad means the observer never reconnects.
  const pageRef = useRef(page);
  const autoLoadUntilPageRef = useRef(autoLoadUntilPage);
  const hasMoreRef = useRef(hasMore);
  const onLoadRef = useRef(onLoad);
  pageRef.current = page;
  autoLoadUntilPageRef.current = autoLoadUntilPage;
  hasMoreRef.current = hasMore;
  onLoadRef.current = onLoad;

  const tryLoad = useCallback(async () => {
    if (!hasMoreRef.current || pageRef.current >= autoLoadUntilPageRef.current) return;
    await onLoadRef.current();
  }, []); // stable — deps read via refs

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void tryLoad();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [tryLoad]); // tryLoad is now stable → effect runs once

  return { ref: sentinelRef };
}
