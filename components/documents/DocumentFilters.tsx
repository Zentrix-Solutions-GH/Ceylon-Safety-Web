"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useRef, type FormEvent } from "react";
import { t } from "@/messages/en";
import type { DocKind, DocumentCategory } from "@/types/document";

const DOC_KINDS: DocKind[] = ["checklist", "safety_sign", "toolbox_talk"];

interface DocumentFiltersProps {
  categories: DocumentCategory[];
}

export function DocumentFilters({ categories }: DocumentFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchRef = useRef<HTMLInputElement>(null);

  const currentCategory = searchParams.get("category") ?? "";
  const currentType = (searchParams.get("type") ?? "") as DocKind | "";

  function buildUrl(category: string, type: string): string {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    if (category) params.set("category", category); else params.delete("category");
    if (type) params.set("type", type); else params.delete("type");
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  function onCategoryChange(e: React.ChangeEvent<HTMLSelectElement>) {
    router.replace(buildUrl(e.target.value, currentType));
  }

  function onTypeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    router.replace(buildUrl(currentCategory, e.target.value));
  }

  function onClearFilters() {
    router.replace(pathname);
  }

  function onSearchSubmit(e: FormEvent) {
    e.preventDefault();
    const q = searchRef.current?.value.trim() ?? "";
    if (!q) return;
    router.replace(`/search?scope=documents&q=${encodeURIComponent(q).replace(/%20/g, "+")}`);
  }

  const hasFilters = Boolean(currentCategory || currentType);

  return (
    <div className="flex flex-wrap items-end gap-3 pb-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="filter-category" className="text-xs font-medium text-gray-600">
          {t("documents.filter.category.label")}
        </label>
        <select
          id="filter-category"
          aria-label={t("documents.filter.category.label")}
          value={currentCategory}
          onChange={onCategoryChange}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="">{t("documents.filter.category.all")}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="filter-type" className="text-xs font-medium text-gray-600">
          {t("documents.filter.type.label")}
        </label>
        <select
          id="filter-type"
          aria-label={t("documents.filter.type.label")}
          value={currentType}
          onChange={onTypeChange}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="">{t("documents.filter.type.all")}</option>
          {DOC_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {t(`documents.filter.type.${kind}`)}
            </option>
          ))}
        </select>
      </div>

      {hasFilters && (
        <button
          type="button"
          onClick={onClearFilters}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
        >
          {t("documents.filter.clear")}
        </button>
      )}

      <form onSubmit={onSearchSubmit} className="ml-auto flex gap-2">
        <input
          ref={searchRef}
          type="search"
          placeholder={t("documents.filter.search.placeholder")}
          aria-label={t("documents.filter.search.label")}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm"
        />
        <button
          type="submit"
          className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
        >
          {t("documents.filter.search.button")}
        </button>
      </form>
    </div>
  );
}

export default DocumentFilters;
