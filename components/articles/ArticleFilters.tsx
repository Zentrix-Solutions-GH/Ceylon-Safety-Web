"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useRef, type FormEvent } from "react";
import { t } from "@/messages/en";
import type { Category, ArticleRange } from "@/types/article";

const VALID_RANGES: ArticleRange[] = ["newest", "week", "month"];

interface ArticleFiltersProps {
  categories: Category[];
}

export function ArticleFilters({ categories }: ArticleFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchRef = useRef<HTMLInputElement>(null);

  const rawRange = searchParams.get("range") ?? "newest";
  const currentRange: ArticleRange = (VALID_RANGES as string[]).includes(rawRange)
    ? (rawRange as ArticleRange)
    : "newest";

  const rawCategory = searchParams.get("category") ?? "";
  const currentCategory = categories.some((c) => c.slug === rawCategory)
    ? rawCategory
    : "";

  function buildUrl(range: string, category: string): string {
    const params = new URLSearchParams();
    if (range && range !== "newest") params.set("range", range);
    if (category) params.set("category", category);
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  function onRangeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    router.replace(buildUrl(e.target.value, currentCategory));
  }

  function onCategoryChange(e: React.ChangeEvent<HTMLSelectElement>) {
    router.replace(buildUrl(currentRange, e.target.value));
  }

  function onClearFilters() {
    router.replace(pathname);
  }

  function onSearchSubmit(e: FormEvent) {
    e.preventDefault();
    const q = searchRef.current?.value.trim() ?? "";
    if (!q) return;
    router.replace(`/search?scope=articles&q=${encodeURIComponent(q).replace(/%20/g, "+")}`);
  }

  const hasFilters = currentRange !== "newest" || currentCategory !== "";

  return (
    <div className="flex flex-wrap items-end gap-3 pb-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="filter-range" className="text-xs font-medium text-gray-600">
          {t("articles.filter.range.label")}
        </label>
        <select
          id="filter-range"
          aria-label={t("articles.filter.range.label")}
          value={currentRange}
          onChange={onRangeChange}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="newest">{t("articles.filter.range.newest")}</option>
          <option value="week">{t("articles.filter.range.week")}</option>
          <option value="month">{t("articles.filter.range.month")}</option>
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="filter-category" className="text-xs font-medium text-gray-600">
          {t("articles.filter.category.label")}
        </label>
        <select
          id="filter-category"
          aria-label={t("articles.filter.category.label")}
          value={currentCategory}
          onChange={onCategoryChange}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="">{t("articles.filter.category.all")}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
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
          {t("articles.filter.clear")}
        </button>
      )}

      <form onSubmit={onSearchSubmit} className="ml-auto flex gap-2">
        <input
          ref={searchRef}
          type="search"
          placeholder={t("articles.filter.search.placeholder")}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm"
        />
        <button
          type="submit"
          className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
        >
          {t("articles.filter.search.button")}
        </button>
      </form>
    </div>
  );
}
