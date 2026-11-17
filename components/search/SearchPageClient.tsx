"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { t } from "@/messages/en";
import SearchBar from "./SearchBar";
import SearchResults from "./SearchResults";
import { useSearch } from "@/hooks/useSearch";
import type { SearchScope } from "@/types/api";

const VALID_SCOPES: SearchScope[] = ["home", "articles", "documents"];

function resolveScope(raw: string | null): SearchScope {
  if (raw && (VALID_SCOPES as string[]).includes(raw)) return raw as SearchScope;
  return "home";
}

export function SearchPageClient() {
  const params = useSearchParams();
  const q = (params.get("q") ?? "").trim();
  const scope = resolveScope(params.get("scope"));
  const { status, items, search, abort } = useSearch();

  useEffect(() => {
    if (q) {
      search(q, scope);
    }
    return abort;
    // Only re-run when q or scope change (from URL).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, scope]);

  return (
    <div className="space-y-6">
      <SearchBar key={q} scope={scope} defaultValue={q} className="flex overflow-hidden rounded-full border border-gray-200 bg-white shadow-sm" />
      {!q ? (
        <p className="text-sm text-gray-500">{t("search.bar.empty_prompt")}</p>
      ) : (
        <SearchResults status={status} items={items} />
      )}
    </div>
  );
}
