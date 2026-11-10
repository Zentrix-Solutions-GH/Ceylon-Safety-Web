"use client";

import { useRef, useEffect, useCallback } from "react";

interface UseInfiniteScrollOptions {
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
  const loadingRef = useRef(false);

  const tryLoad = useCallback(async () => {
    if (loadingRef.current || !hasMore || page >= autoLoadUntilPage) return;
    loadingRef.current = true;
    try {
      await onLoad();
    } finally {
      loadingRef.current = false;
    }
  }, [hasMore, page, autoLoadUntilPage, onLoad]);

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
  }, [tryLoad]);

  return { ref: sentinelRef };
}
