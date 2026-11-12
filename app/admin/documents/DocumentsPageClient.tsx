"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { t } from "@/messages/en";
import { DocumentsTable } from "@/components/admin/DocumentsTable";
import type { AdminDocumentRow, DocumentStatus, DocKind } from "@/types/document";
import type { Category } from "@/types/article";

interface Props {
  initialRows: AdminDocumentRow[];
  total: number;
  page: number;
  pageSize: number;
  categories: Category[];
  initialStatus: DocumentStatus | "";
  initialKind: DocKind | "";
  initialCategory: string;
  initialTitle: string;
}

const PAGE_SIZE = 25;

export default function DocumentsPageClient({
  initialRows,
  total,
  page,
  pageSize,
  categories,
  initialStatus,
  initialKind,
  initialCategory,
  initialTitle,
}: Props) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | "">(initialStatus);
  const [kindFilter, setKindFilter] = useState<DocKind | "">(initialKind);
  const [categoryFilter, setCategoryFilter] = useState(initialCategory);
  const [titleFilter, setTitleFilter] = useState(initialTitle);
  const titleDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pageCount = Math.max(1, Math.ceil(total / (pageSize || PAGE_SIZE)));

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(window.location.search);
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      if (key !== "page") params.delete("page");
      router.replace("/admin/documents?" + params.toString());
    },
    [router]
  );

  useEffect(() => {
    return () => {
      if (titleDebounce.current) clearTimeout(titleDebounce.current);
    };
  }, []);

  function handleStatusChange(value: DocumentStatus | "") {
    setStatusFilter(value);
    updateParam("status", value);
  }

  function handleKindChange(value: DocKind | "") {
    setKindFilter(value);
    updateParam("kind", value);
  }

  function handleCategoryChange(value: string) {
    setCategoryFilter(value);
    updateParam("category", value);
  }

  function handleTitleChange(value: string) {
    setTitleFilter(value);
    if (titleDebounce.current) clearTimeout(titleDebounce.current);
    titleDebounce.current = setTimeout(() => {
      updateParam("search", value);
    }, 300);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("admin.documents.page_title")}</h1>
        <Link
          href="/admin/documents/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {t("admin.documents.new_button")}
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          aria-label={t("admin.documents.filter_status_all")}
          value={statusFilter}
          onChange={(e) => handleStatusChange(e.target.value as DocumentStatus | "")}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
        >
          <option value="">{t("admin.documents.filter_status_all")}</option>
          <option value="draft">{t("admin.documents.filter_status_draft")}</option>
          <option value="published">{t("admin.documents.filter_status_published")}</option>
          <option value="hidden">{t("admin.documents.filter_status_hidden")}</option>
        </select>

        <select
          aria-label={t("admin.documents.filter_type_all")}
          value={kindFilter}
          onChange={(e) => handleKindChange(e.target.value as DocKind | "")}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
        >
          <option value="">{t("admin.documents.filter_type_all")}</option>
          <option value="checklist">{t("admin.documents.filter_type_checklist")}</option>
          <option value="safety_sign">{t("admin.documents.filter_type_safety_sign")}</option>
          <option value="toolbox_talk">{t("admin.documents.filter_type_toolbox_talk")}</option>
        </select>

        <select
          aria-label={t("admin.documents.filter_category_all")}
          value={categoryFilter}
          onChange={(e) => handleCategoryChange(e.target.value)}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
        >
          <option value="">{t("admin.documents.filter_category_all")}</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>

        <input
          type="search"
          aria-label={t("admin.documents.filter_title_placeholder")}
          placeholder={t("admin.documents.filter_title_placeholder")}
          value={titleFilter}
          onChange={(e) => handleTitleChange(e.target.value)}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm min-w-48"
        />
      </div>

      <DocumentsTable rows={initialRows} />

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center justify-between pt-2 text-sm">
          <span className="text-muted-foreground">
            {t("admin.documents.page_label", {
              current: String(page),
              total: String(pageCount),
            })}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <button
                onClick={() => updateParam("page", String(page - 1))}
                className="rounded-md border border-border px-3 py-1.5 hover:bg-muted"
              >
                {t("admin.documents.page_prev")}
              </button>
            )}
            {page < pageCount && (
              <button
                onClick={() => updateParam("page", String(page + 1))}
                className="rounded-md border border-border px-3 py-1.5 hover:bg-muted"
              >
                {t("admin.documents.page_next")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
