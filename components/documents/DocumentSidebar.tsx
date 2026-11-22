"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { t } from "@/messages/en";
import type { DocKind, DocumentCategory } from "@/types/document";

const FORMAT_OPTIONS: { value: DocKind; label: string; badge: string; badgeColor: string }[] = [
  { value: "checklist", label: t("documents.filter.format.checklist"), badge: "PDF", badgeColor: "bg-red-600" },
  { value: "toolbox_talk", label: t("documents.filter.format.toolbox_talk"), badge: "PPT", badgeColor: "bg-orange-500" },
  { value: "safety_sign", label: t("documents.filter.format.safety_sign"), badge: "IMG", badgeColor: "bg-blue-600" },
];

interface DocumentSidebarProps {
  categories: DocumentCategory[];
  /** Passed through for the mobile drawer's onSortChange callback only */
  onSortChange?: (sort: "newest" | "popular") => void;
}

export function DocumentSidebar({ categories, onSortChange }: DocumentSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [topicsOpen, setTopicsOpen] = useState(true);
  const [formatOpen, setFormatOpen] = useState(true);

  const currentCategory = searchParams.get("category") ?? "";
  const currentType = (searchParams.get("type") ?? "") as DocKind | "";
  // Read sort directly from the URL so both desktop and mobile sidebars stay in sync
  const isMostDownloaded = searchParams.get("sort") === "popular";

  function buildUrl(category: string, type: string): string {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    if (category) params.set("category", category); else params.delete("category");
    if (type) params.set("type", type); else params.delete("type");
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  function toggleCategory(id: string) {
    const next = currentCategory === id ? "" : id;
    router.replace(buildUrl(next, currentType));
  }

  function toggleType(value: DocKind) {
    const next = currentType === value ? "" : value;
    router.replace(buildUrl(currentCategory, next));
  }

  function clearFilters() {
    router.replace(pathname);
  }

  function toggleMostDownloaded() {
    const params = new URLSearchParams(searchParams.toString());
    const next = isMostDownloaded ? "newest" : "popular";
    params.set("sort", next);
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`);
    if (onSortChange) onSortChange(next);
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <svg className="h-4 w-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
        <span className="text-sm font-bold text-gray-900">{t("documents.filter.header")}</span>
      </div>

      {/* INDUSTRIAL TOPICS */}
      <div className="mb-4">
        <button
          type="button"
          className="mb-2 flex w-full items-center justify-between"
          onClick={() => setTopicsOpen((v) => !v)}
        >
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
            {t("documents.filter.topics.label")}
          </span>
          <svg className={`h-3 w-3 text-gray-400 transition ${topicsOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {topicsOpen && (
          <ul className="space-y-0.5">
            <li>
              <button
                type="button"
                onClick={() => router.replace(buildUrl("", currentType))}
                className={`flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-xs transition hover:bg-gray-50 ${
                  !currentCategory ? "font-semibold text-red-600" : "text-gray-700"
                }`}
              >
                <span className={`inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border ${
                  !currentCategory ? "border-red-600 bg-red-600" : "border-gray-300"
                }`}>
                  {!currentCategory && (
                    <svg className="h-2.5 w-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </span>
                <span className="flex-1 text-xs">{t("documents.filter.category.all")}</span>
              </button>
            </li>
            {categories.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => toggleCategory(c.id)}
                  className={`flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-xs transition hover:bg-gray-50 ${
                    currentCategory === c.id ? "font-semibold text-red-600" : "text-gray-700"
                  }`}
                >
                  <span className={`inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border ${
                    currentCategory === c.id ? "border-red-600 bg-red-600" : "border-gray-300"
                  }`}>
                    {currentCategory === c.id && (
                      <svg className="h-2.5 w-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </span>
                  <span className="flex-1 text-xs">{c.name}</span>
                  {c.count != null && (
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[9px] font-semibold text-gray-500">
                      {c.count}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mb-4 border-t border-gray-100" />

      {/* FORMAT / EXTENSION */}
      <div className="mb-4">
        <button
          type="button"
          className="mb-2 flex w-full items-center justify-between"
          onClick={() => setFormatOpen((v) => !v)}
        >
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
            {t("documents.filter.format.label")}
          </span>
          <svg className={`h-3 w-3 text-gray-400 transition ${formatOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {formatOpen && (
          <ul className="space-y-0.5">
            {FORMAT_OPTIONS.map((opt) => (
              <li key={opt.value}>
                <button
                  type="button"
                  onClick={() => toggleType(opt.value)}
                  className={`flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-xs transition hover:bg-gray-50 ${
                    currentType === opt.value ? "font-semibold text-red-600" : "text-gray-700"
                  }`}
                >
                  <span className={`inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border ${
                    currentType === opt.value ? "border-red-600 bg-red-600" : "border-gray-300"
                  }`}>
                    {currentType === opt.value && (
                      <svg className="h-2.5 w-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </span>
                  <span className="flex-1 text-xs">{opt.label}</span>
                  <span className={`rounded px-1 py-0.5 text-[9px] font-bold text-white ${opt.badgeColor}`}>
                    {opt.badge}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mb-4 border-t border-gray-100" />

      {/* Most Downloaded toggle */}
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-700">{t("documents.filter.most_downloaded")}</span>
        <button
          type="button"
          role="switch"
          aria-checked={isMostDownloaded}
          onClick={toggleMostDownloaded}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            isMostDownloaded ? "bg-red-600" : "bg-gray-200"
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
              isMostDownloaded ? "translate-x-4" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      <div className="mb-4 border-t border-gray-100" />

      {/* Reset Filters */}
      <button
        type="button"
        onClick={clearFilters}
        className="w-full rounded-lg border border-red-600 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50"
      >
        {t("documents.filter.reset")}
      </button>
    </div>
  );
}

export default DocumentSidebar;
