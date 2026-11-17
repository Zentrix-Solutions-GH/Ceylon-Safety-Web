"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
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

  function setCategory(slug: string) {
    router.replace(buildUrl(currentRange, slug));
  }

  function setRange(range: string) {
    router.replace(buildUrl(range, currentCategory));
  }

  return (
    <div className="mb-6 space-y-3">
      {/* Category pills */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCategory("")}
          className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
            currentCategory === ""
              ? "border-red-600 bg-red-600 text-white"
              : "border-gray-300 bg-white text-gray-700 hover:border-red-400 hover:text-red-600"
          }`}
        >
          {t("articles.filter.category.all")}
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategory(c.slug)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
              currentCategory === c.slug
                ? "border-red-600 bg-red-600 text-white"
                : "border-gray-300 bg-white text-gray-700 hover:border-red-400 hover:text-red-600"
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Range tabs + count row */}
      <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 pt-3">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {t("articles.filter.range.label")}:
        </span>
        {VALID_RANGES.map((r) => {
          const labels: Record<ArticleRange, string> = {
            newest: t("articles.filter.range.newest"),
            week: t("articles.filter.range.week"),
            month: t("articles.filter.range.month"),
          };
          return (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                currentRange === r
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {labels[r]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
