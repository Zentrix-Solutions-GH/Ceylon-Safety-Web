"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { t } from "@/messages/en";
import { ARTICLE_RANGES, ARTICLE_TYPES } from "@/types/article";
import type { Category, ArticleRange, ArticleType } from "@/types/article";

interface ArticleFiltersProps {
  categories: Category[];
}

export function ArticleFilters({ categories }: ArticleFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const rawRange = searchParams.get("range") ?? "newest";
  const currentRange: ArticleRange = (ARTICLE_RANGES as string[]).includes(rawRange)
    ? (rawRange as ArticleRange)
    : "newest";

  const rawCategory = searchParams.get("category") ?? "";
  const currentCategory = categories.some((c) => c.slug === rawCategory)
    ? rawCategory
    : "";

  const rawType = searchParams.get("type") ?? "";
  const currentType: ArticleType | "" = (ARTICLE_TYPES as string[]).includes(rawType)
    ? (rawType as ArticleType)
    : "";

  const hasActiveFilter = currentRange !== "newest" || currentCategory !== "" || currentType !== "";

  function buildUrl(range: string, category: string, type: string): string {
    const params = new URLSearchParams();
    if (range && range !== "newest") params.set("range", range);
    if (category) params.set("category", category);
    if (type) params.set("type", type);
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  function setCategory(slug: string) {
    router.replace(buildUrl(currentRange, slug, currentType));
  }

  function setRange(range: string) {
    router.replace(buildUrl(range, currentCategory, currentType));
  }

  function setType(type: string) {
    router.replace(buildUrl(currentRange, currentCategory, type));
  }

  function clearAll() {
    router.replace(pathname);
  }

  const rangeLabels: Record<ArticleRange, string> = {
    newest: t("articles.filter.range.newest"),
    week: t("articles.filter.range.week"),
    month: t("articles.filter.range.month"),
  };

  const typeLabels: Record<ArticleType, string> = {
    article: t("articles.filter.type.article"),
    guide: t("articles.filter.type.guide"),
    news: t("articles.filter.type.news"),
    tip: t("articles.filter.type.tip"),
  };

  const activeCategoryName = categories.find((c) => c.slug === currentCategory)?.name;

  return (
    <div className="mb-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* ── Row 1: Sort by + active chips ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
        {/* Sort by dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-600">
            {t("articles.filter.sort_by")}:
          </span>
          <div className="relative">
            <select
              value={currentRange}
              onChange={(e) => setRange(e.target.value)}
              className="appearance-none rounded-md border border-gray-300 bg-white py-1.5 pl-3 pr-8 text-sm font-medium text-gray-700 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            >
              {ARTICLE_RANGES.map((r) => (
                <option key={r} value={r}>
                  {rangeLabels[r]}
                </option>
              ))}
            </select>
            {/* chevron */}
            <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-gray-500">
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
              </svg>
            </span>
          </div>
        </div>

        {/* Active filter chips + clear */}
        <div className="flex flex-wrap items-center gap-2">
          {activeCategoryName && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700 ring-1 ring-red-200">
              {activeCategoryName}
              <button
                type="button"
                aria-label={`Remove ${activeCategoryName} filter`}
                onClick={() => setCategory("")}
                className="ml-0.5 text-red-500 hover:text-red-700"
              >
                ×
              </button>
            </span>
          )}
          {currentType && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700 ring-1 ring-red-200">
              {typeLabels[currentType]}
              <button
                type="button"
                aria-label={`Remove ${typeLabels[currentType]} filter`}
                onClick={() => setType("")}
                className="ml-0.5 text-red-500 hover:text-red-700"
              >
                ×
              </button>
            </span>
          )}
          {hasActiveFilter && (
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex items-center gap-1 rounded-full border border-gray-300 px-3 py-1 text-xs font-medium text-gray-600 hover:border-red-400 hover:text-red-600"
            >
              <svg className="h-3 w-3" viewBox="0 0 16 16" fill="currentColor">
                <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
              </svg>
              {t("articles.filter.clear")}
            </button>
          )}
        </div>
      </div>

      {/* ── Row 2: Category pills ── */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
          {t("articles.filter.category.label")}:
        </span>
        <button
          type="button"
          aria-pressed={currentCategory === ""}
          onClick={() => setCategory("")}
          className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
            currentCategory === ""
              ? "border-red-600 bg-red-600 text-white"
              : "border-gray-200 bg-gray-50 text-gray-600 hover:border-red-400 hover:text-red-600"
          }`}
        >
          {t("articles.filter.category.all")}
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={currentCategory === c.slug}
            onClick={() => setCategory(c.slug)}
            className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
              currentCategory === c.slug
                ? "border-red-600 bg-red-600 text-white"
                : "border-gray-200 bg-gray-50 text-gray-600 hover:border-red-400 hover:text-red-600"
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* ── Row 3: Type pills ── */}
      <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 px-4 py-3">
        <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
          {t("articles.filter.type.label")}:
        </span>
        <button
          type="button"
          aria-pressed={currentType === ""}
          onClick={() => setType("")}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            currentType === ""
              ? "border-red-600 bg-red-600 text-white"
              : "border-gray-200 bg-gray-50 text-gray-600 hover:border-red-400 hover:text-red-600"
          }`}
        >
          {t("articles.filter.type.all")}
        </button>
        {ARTICLE_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            aria-pressed={currentType === type}
            onClick={() => setType(type)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              currentType === type
                ? "border-red-600 bg-red-600 text-white"
                : "border-gray-200 bg-gray-50 text-gray-600 hover:border-red-400 hover:text-red-600"
            }`}
          >
            {typeLabels[type]}
          </button>
        ))}
      </div>
    </div>
  );
}
