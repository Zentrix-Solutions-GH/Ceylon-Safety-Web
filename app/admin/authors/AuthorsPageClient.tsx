"use client";

import { useState } from "react";
import Link from "next/link";
import { t } from "@/messages/en";
import { setAuthorActive } from "@/lib/authors/actions/setAuthorActive";
import DataTable, { type Column } from "@/components/admin/DataTable";
import type { Author } from "@/types/author";

interface Props {
  initialAuthors: Author[];
}

export default function AuthorsPageClient({ initialAuthors }: Props) {
  const [authors, setAuthors] = useState(initialAuthors);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function handleToggle(author: Author) {
    if (togglingId) return;
    setTogglingId(author.id);
    setToggleError(null);
    const result = await setAuthorActive({
      id: author.id,
      active: !author.isActive,
      updatedAt: author.updatedAt,
    });
    setTogglingId(null);

    if (!result.ok) {
      setToggleError(t("admin.authors.form_toggle_error"));
      return;
    }

    setAuthors((prev) =>
      prev.map((a) => (a.id === author.id ? result.author : a))
    );
  }

  const columns: Column<Author>[] = [
    {
      key: "name",
      header: t("admin.authors.col_name"),
      render: (author) => <span className="font-medium">{author.name}</span>,
    },
    {
      key: "status",
      header: t("admin.authors.col_status"),
      render: (author) =>
        author.isActive ? (
          <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
            {t("admin.authors.badge_active")}
          </span>
        ) : (
          <span
            data-testid={`author-inactive-badge-${author.id}`}
            className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600"
          >
            {t("admin.authors.badge_inactive")}
          </span>
        ),
    },
    {
      key: "actions",
      header: t("admin.authors.col_actions"),
      render: (author) => (
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/authors/${author.id}/edit`}
            className="text-primary underline-offset-4 hover:underline text-sm"
          >
            {t("admin.authors.edit_link")}
          </Link>
          <button
            data-testid={`author-toggle-active-${author.id}`}
            onClick={() => handleToggle(author)}
            disabled={togglingId === author.id}
            className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            {author.isActive
              ? t("admin.authors.deactivate_button")
              : t("admin.authors.reactivate_button")}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("admin.authors.page_title")}</h1>
        <Link
          href="/admin/authors/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          {t("admin.authors.add_button")}
        </Link>
      </div>

      {toggleError && (
        <p className="text-xs text-destructive">{toggleError}</p>
      )}

      <DataTable<Author>
        columns={columns}
        rows={authors}
        getRowKey={(a) => a.id}
        getRowClassName={(a) => (!a.isActive ? "opacity-50" : "")}
        getRowProps={(a) => ({ "data-testid": `author-row-${a.id}` })}
      />
    </div>
  );
}
