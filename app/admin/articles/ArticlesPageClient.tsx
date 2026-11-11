"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { t } from "@/messages/en";
import DataTable, { type Column } from "@/components/admin/DataTable";
import ArticleStatusBadge from "@/components/admin/ArticleStatusBadge";
import type { AdminArticleRow, ArticleStatus } from "@/types/article";
import type { Category } from "@/types/article";

interface Props {
  initialArticles: AdminArticleRow[];
  pageCount: number;
  currentPage: number;
  categories: Category[];
}

type FilterStatus = ArticleStatus | "scheduled" | "";

export default function ArticlesPageClient({ initialArticles, pageCount, currentPage, categories }: Props) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [titleFilter, setTitleFilter] = useState("");
  const titleDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(window.location.search);
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.replace("/admin/articles?" + params.toString());
    },
    [router]
  );

  function handleStatusChange(value: FilterStatus) {
    setStatusFilter(value);
    updateParam("status", value);
  }

  function handleCategoryChange(value: string) {
    setCategoryFilter(value);
    updateParam("category", value);
  }

  function handleTitleChange(value: string) {
    setTitleFilter(value);
    if (titleDebounce.current) clearTimeout(titleDebounce.current);
    if (value.length >= 2 || value.length === 0) {
      titleDebounce.current = setTimeout(() => {
        updateParam("title", value);
      }, 300);
    }
  }

  useEffect(() => {
    return () => {
      if (titleDebounce.current) clearTimeout(titleDebounce.current);
    };
  }, []);

  const columns: Column<AdminArticleRow>[] = [
    {
      key: "title",
      header: t("admin.articles.col_title"),
      render: (row) => <span className="font-medium">{row.title}</span>,
    },
    {
      key: "status",
      header: t("admin.articles.col_status"),
      render: (row) => (
        <ArticleStatusBadge
          status={row.status}
          data-testid={`status-badge-${row.id}`}
        />
      ),
    },
    {
      key: "category",
      header: t("admin.articles.col_category"),
      render: (row) => row.categoryName,
    },
    {
      key: "author",
      header: t("admin.articles.col_author"),
      render: (row) => row.authorName,
    },
    {
      key: "updatedAt",
      header: t("admin.articles.col_updated"),
      render: (row) => new Date(row.updatedAt).toLocaleDateString(),
    },
    {
      key: "actions",
      header: t("admin.articles.col_actions"),
      render: (row) => (
        <Link
          href={`/admin/articles/${row.id}/edit`}
          className="text-primary underline-offset-4 hover:underline text-sm"
        >
          {t("admin.articles.edit_link")}
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("admin.articles.page_title")}</h1>
        <Link
          href="/admin/articles/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          {t("admin.articles.new_button")}
        </Link>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          data-testid="filter-status"
          value={statusFilter}
          onChange={(e) => handleStatusChange(e.target.value as FilterStatus)}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
        >
          <option value="">{t("admin.articles.filter_status_all")}</option>
          <option value="draft">{t("admin.articles.filter_status_draft")}</option>
          <option value="scheduled">{t("admin.articles.filter_status_scheduled")}</option>
          <option value="published">{t("admin.articles.filter_status_published")}</option>
          <option value="hidden">{t("admin.articles.filter_status_hidden")}</option>
        </select>

        <select
          data-testid="filter-category"
          value={categoryFilter}
          onChange={(e) => handleCategoryChange(e.target.value)}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
        >
          <option value="">{t("admin.articles.filter_category_all")}</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.slug}>
              {cat.name}
            </option>
          ))}
        </select>

        <input
          data-testid="filter-title"
          type="text"
          value={titleFilter}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder={t("admin.articles.filter_title_placeholder")}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm min-w-[200px]"
        />
      </div>

      {initialArticles.length === 0 ? (
        <div data-testid="articles-empty" className="py-12 text-center text-muted-foreground">
          <p>{t("admin.articles.empty")}</p>
          <Link
            href="/admin/articles"
            className="mt-2 inline-block text-sm text-primary underline-offset-4 hover:underline"
          >
            {t("admin.articles.clear_filters")}
          </Link>
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={initialArticles}
          getRowKey={(row) => row.id}
        />
      )}

      {pageCount > 1 && (
        <div data-testid="articles-pagination" className="flex items-center justify-between pt-2">
          <button
            data-testid="pagination-prev"
            onClick={() => updateParam("page", String(currentPage - 1))}
            disabled={currentPage <= 1}
            className="rounded-md border border-border px-3 py-1.5 text-sm disabled:opacity-40"
          >
            {t("admin.articles.page_prev")}
          </button>
          <span className="text-sm text-muted-foreground">
            {t("admin.articles.page_label")
              .replace("{current}", String(currentPage))
              .replace("{total}", String(pageCount))}
          </span>
          <button
            data-testid="pagination-next"
            onClick={() => updateParam("page", String(currentPage + 1))}
            disabled={currentPage >= pageCount}
            className="rounded-md border border-border px-3 py-1.5 text-sm disabled:opacity-40"
          >
            {t("admin.articles.page_next")}
          </button>
        </div>
      )}
    </div>
  );
}
