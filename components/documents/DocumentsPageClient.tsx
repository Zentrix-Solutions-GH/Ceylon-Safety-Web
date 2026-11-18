"use client";

import { useRef, useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { DocumentGrid } from "./DocumentGrid";
import { DocumentSidebar } from "./DocumentSidebar";
import { t } from "@/messages/en";
import type { PublicDocumentCard } from "@/types/document";

interface DocumentsPageClientProps {
  docs: PublicDocumentCard[];
  mediaBase: string;
  allSlugs: string[];
  total?: number;
  pageSize?: number;
  currentPage?: number;
  sort?: "newest" | "popular";
}

export function DocumentsPageClient({
  docs,
  mediaBase,
  allSlugs,
  total = 0,
  pageSize = 12,
  currentPage = 1,
  sort = "newest",
}: DocumentsPageClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const scrollRef = useRef<number>(0);
  const prevModalSlugRef = useRef<string | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const isFiltered = Boolean(searchParams.get("category") || searchParams.get("type"));
  const knownSlugs = new Set(allSlugs);
  const rawParam = searchParams.get("document");
  const modalSlug = rawParam && knownSlugs.has(rawParam) ? rawParam : null;
  const totalPages = Math.ceil(total / pageSize);

  useEffect(() => {
    const wasOpen = prevModalSlugRef.current !== null;
    const isOpen = modalSlug !== null;
    if (!wasOpen && isOpen) {
      scrollRef.current = window.scrollY;
    } else if (wasOpen && !isOpen) {
      window.scrollTo({ top: scrollRef.current });
    }
    prevModalSlugRef.current = modalSlug;
  }, [modalSlug]);

  function onOpen(slug: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("document", slug);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function setSort(value: "newest" | "popular") {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", value);
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`);
  }

  function goToPage(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(p));
    router.replace(`${pathname}?${params.toString()}`, { scroll: true });
  }

  // Category/type info for mobile filter sidebar
  const categories = Array.from(
    new Set(docs.filter((d) => d.categoryName).map((d) => `${d.categoryId}::${d.categoryName}`))
  ).map((entry) => {
    const [id, name] = entry.split("::");
    return { id, name };
  });

  return (
    <div>
      {/* Top bar: result count + sort + mobile filter toggle */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          {total > 0
            ? `${total} document${total !== 1 ? "s" : ""} found`
            : ""}
        </p>
        <div className="flex items-center gap-3">
          {/* Mobile filter button */}
          <button
            type="button"
            className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 lg:hidden"
            onClick={() => setMobileFiltersOpen(true)}
          >
            Filters
          </button>
          {/* Sort tabs */}
          <div className="flex overflow-hidden rounded border border-gray-200">
            {(["newest", "popular"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSort(s)}
                className={`px-3 py-1.5 text-xs font-medium transition ${
                  sort === s
                    ? "bg-red-600 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {s === "newest" ? "Newest" : "Popular"}
              </button>
            ))}
          </div>
          {isFiltered && (
            <button
              type="button"
              onClick={() => router.replace(pathname)}
              className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50"
            >
              {t("documents.filter.clear")}
            </button>
          )}
        </div>
      </div>

      {/* Grid */}
      <DocumentGrid docs={docs} mediaBase={mediaBase} onOpen={onOpen} isFiltered={isFiltered} />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-1">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => goToPage(currentPage - 1)}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-gray-50"
          >
            ‹
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => goToPage(p)}
              className={`rounded border px-3 py-1.5 text-sm transition ${
                p === currentPage
                  ? "border-red-600 bg-red-600 text-white"
                  : "border-gray-300 hover:bg-gray-50"
              }`}
            >
              {p}
            </button>
          ))}
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => goToPage(currentPage + 1)}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-gray-50"
          >
            ›
          </button>
        </div>
      )}

      {/* Mobile filter drawer */}
      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileFiltersOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute left-0 top-0 h-full w-72 overflow-y-auto bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-bold text-gray-900">Filters</h2>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                className="rounded p-1 text-gray-500 hover:bg-gray-100"
              >
                ✕
              </button>
            </div>
            <DocumentSidebar categories={categories} />
          </div>
        </div>
      )}
    </div>
  );
}
