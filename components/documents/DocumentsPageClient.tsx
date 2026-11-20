"use client";

import { useRef, useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { DocumentGrid } from "./DocumentGrid";
import { DocumentSidebar } from "./DocumentSidebar";
import { t } from "@/messages/en";
import type { MessageKey } from "@/messages/en";
import { formatPrice } from "@/lib/utils/price";
import type { PublicDocumentCard, DocumentCategory, DocKind } from "@/types/document";

const DOC_KIND_LABEL: Record<DocKind, MessageKey> = {
  checklist: "documents.filter.type.checklist",
  safety_sign: "documents.filter.type.safety_sign",
  toolbox_talk: "documents.filter.type.toolbox_talk",
};

const LIST_PLACEHOLDER = "/images/document-placeholder.jpg";

function DocListRow({
  doc,
  mediaBase,
  onOpen,
}: {
  doc: PublicDocumentCard;
  mediaBase: string;
  onOpen: (slug: string) => void;
}) {
  const [imgSrc, setImgSrc] = useState(
    doc.coverImageKey ? `${mediaBase}/${doc.coverImageKey}` : LIST_PLACEHOLDER
  );
  const isFree = doc.priceCents === 0;
  const price = formatPrice(doc.priceCents);
  return (
    <article
      key={doc.slug}
      className="flex gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md"
    >
      <div className="h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-gray-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imgSrc}
          alt={doc.title}
          className="h-full w-full object-cover"
          onError={() => setImgSrc(LIST_PLACEHOLDER)}
        />
      </div>
      <div className="min-w-0 flex-1">
        {doc.categoryName && (
          <span className="text-[10px] font-bold uppercase tracking-widest text-red-600">{doc.categoryName}</span>
        )}
        <h3 className="mt-0.5 line-clamp-1 text-sm font-bold text-gray-900">{doc.title}</h3>
        <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-gray-500">
          {doc.pageCount != null && <span>{t("documents.card.pages", { n: String(doc.pageCount) })}</span>}
          <span>{t("documents.card.downloads", { n: String(doc.downloadCount) })}</span>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end justify-between">
        <span className={`text-sm font-extrabold ${isFree ? "text-green-600" : "text-gray-900"}`}>
          {isFree ? t("documents.card.free") : t("documents.card.price", { price })}
        </span>
        <button
          type="button"
          onClick={() => onOpen(doc.slug)}
          className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700"
        >
          {isFree ? t("documents.card.get_free") : t("documents.card.add_to_cart")}
        </button>
      </div>
    </article>
  );
}

interface DocumentsPageClientProps {
  docs: PublicDocumentCard[];
  mediaBase: string;
  allCategories: DocumentCategory[];
  total?: number;
  pageSize?: number;
  currentPage?: number;
  sort?: "newest" | "popular";
}

const SORT_OPTIONS: { value: "newest" | "popular"; label: string }[] = [
  { value: "popular", label: t("documents.sort.popular") },
  { value: "newest", label: t("documents.sort.newest") },
];

export function DocumentsPageClient({
  docs,
  mediaBase,
  allCategories,
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
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const currentCategory = searchParams.get("category") ?? "";
  const currentType = searchParams.get("type") ?? "";
  const isFiltered = Boolean(currentCategory || currentType);
  const knownSlugs = new Set(docs.map((d) => d.slug));
  const rawParam = searchParams.get("document");
  const modalSlug = rawParam && knownSlugs.has(rawParam) ? rawParam : null;
  const totalPages = Math.ceil(total / pageSize);

  // Showing X-Y of N
  const from = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const to = Math.min(currentPage * pageSize, total);

  // Active filter chip labels
  const activeCategoryName = allCategories.find((c) => c.id === currentCategory)?.name;

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

  function removeFilter(key: "category" | "type") {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(key);
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`);
  }

  // Clamp pagination display: show up to 7 items with ellipsis
  function getPageNumbers(): (number | "…")[] {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "…")[] = [];
    pages.push(1);
    if (currentPage > 3) pages.push("…");
    for (let p = Math.max(2, currentPage - 1); p <= Math.min(totalPages - 1, currentPage + 1); p++) {
      pages.push(p);
    }
    if (currentPage < totalPages - 2) pages.push("…");
    pages.push(totalPages);
    return pages;
  }

  return (
    <div>
      {/* Top bar */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        {/* Result count */}
        <p className="text-xs text-gray-500">
          {total > 0
            ? t("documents.results.showing", {
                from: String(from),
                to: String(to),
                total: String(total),
                label: t("documents.results.label"),
              })
            : ""}
        </p>

        {/* Right controls */}
        <div className="flex items-center gap-2">
          {/* Mobile filter button */}
          <button
            type="button"
            className="flex items-center gap-1.5 rounded border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 lg:hidden"
            onClick={() => setMobileFiltersOpen(true)}
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            {t("documents.filter.mobile_open")}
          </button>

          {/* Sort tabs */}
          <div className="flex overflow-hidden rounded border border-gray-200">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSort(opt.value)}
                className={`px-3 py-1.5 text-xs font-medium transition ${
                  sort === opt.value
                    ? "bg-red-600 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Grid / List toggle */}
          <div className="hidden items-center gap-1 sm:flex">
            <button
              type="button"
              aria-label={t("documents.view.grid")}
              onClick={() => setViewMode("grid")}
              className={`rounded p-1.5 ${viewMode === "grid" ? "bg-red-600 text-white" : "text-gray-500 hover:bg-gray-100"}`}
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zm0 8a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zm6-6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zm0 8a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              type="button"
              aria-label={t("documents.view.list")}
              onClick={() => setViewMode("list")}
              className={`rounded p-1.5 ${viewMode === "list" ? "bg-red-600 text-white" : "text-gray-500 hover:bg-gray-100"}`}
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Active filter chips */}
      {isFiltered && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {activeCategoryName && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
              {activeCategoryName}
              <button
                type="button"
                onClick={() => removeFilter("category")}
                className="ml-0.5 rounded-full hover:text-red-900"
                aria-label={t("documents.filter.chip.remove_category", { name: activeCategoryName ?? "" })}
              >
                ✕
              </button>
            </span>
          )}
          {currentType && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
              {currentType in DOC_KIND_LABEL ? t(DOC_KIND_LABEL[currentType as DocKind]) : currentType}
              <button
                type="button"
                onClick={() => removeFilter("type")}
                className="ml-0.5 rounded-full hover:text-red-900"
                aria-label={t("documents.filter.chip.remove_type")}
              >
                ✕
              </button>
            </span>
          )}
        </div>
      )}

      {/* Grid / List */}
      {viewMode === "grid" ? (
        <DocumentGrid docs={docs} mediaBase={mediaBase} onOpen={onOpen} isFiltered={isFiltered} />
      ) : (
        <div className="space-y-3">
          {docs.map((doc) => (
            <DocListRow key={doc.slug} doc={doc} mediaBase={mediaBase} onOpen={onOpen} />
          ))}
          {docs.length === 0 && (
            <p className="py-16 text-center text-sm text-gray-400">
              {isFiltered ? t("documents.empty.filtered") : t("documents.empty.all")}
            </p>
          )}
        </div>
      )}

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
          {getPageNumbers().map((p, i) =>
            p === "…" ? (
              <span key={`ellipsis-${i}`} className="px-2 py-1.5 text-sm text-gray-400">…</span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => goToPage(p as number)}
                className={`rounded border px-3 py-1.5 text-sm transition ${
                  p === currentPage
                    ? "border-red-600 bg-red-600 text-white"
                    : "border-gray-300 hover:bg-gray-50"
                }`}
              >
                {p}
              </button>
            )
          )}
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
              <h2 className="font-bold text-gray-900">{t("documents.filter.mobile_title")}</h2>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                className="rounded p-1 text-gray-500 hover:bg-gray-100"
              >
                ✕
              </button>
            </div>
            <DocumentSidebar
              categories={allCategories}
              onSortChange={(s) => { setSort(s); setMobileFiltersOpen(false); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
