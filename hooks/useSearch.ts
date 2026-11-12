"use client";

import { useCallback, useRef, useState } from "react";
import type { SearchResultItem, SearchScope } from "@/types/api";

export type SearchStatus = "idle" | "loading" | "success" | "error" | "rate_limited";

export type UseSearchResult = {
  status: SearchStatus;
  items: SearchResultItem[];
  search: (query: string, scope: SearchScope) => void;
  abort: () => void;
};

export function useSearch(): UseSearchResult {
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [items, setItems] = useState<SearchResultItem[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const genRef = useRef(0);

  const search = useCallback((query: string, scope: SearchScope) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const gen = ++genRef.current;

    setStatus("loading");
    setItems([]);

    const params = new URLSearchParams({ scope, q: query });

    fetch(`/api/search?${params.toString()}`, { signal: controller.signal })
      .then(async (res) => {
        if (genRef.current !== gen) return;
        if (res.status === 429) {
          setStatus("rate_limited");
          return;
        }
        if (!res.ok) {
          setStatus("error");
          return;
        }
        const json = await res.json();
        if (genRef.current !== gen) return;
        setItems(json.items ?? []);
        setStatus("success");
      })
      .catch((err) => {
        if ((err as Error).name === "AbortError") return;
        if (genRef.current !== gen) return;
        setStatus("error");
        setItems([]);
      });
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { status, items, search, abort };
}
