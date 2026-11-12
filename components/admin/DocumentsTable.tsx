"use client";

import Link from "next/link";
import DataTable, { type Column } from "@/components/admin/DataTable";
import { t } from "@/messages/en";
import type { AdminDocumentRow, DocumentFileMark, DocKind, DocumentStatus } from "@/types/document";

function formatPriceLkr(cents: number): string {
  return (cents / 100).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function statusLabel(status: DocumentStatus): string {
  if (status === "draft") return t("admin.documents.status_draft");
  if (status === "published") return t("admin.documents.status_published");
  return t("admin.documents.status_hidden");
}

function typeLabel(kind: DocKind): string {
  if (kind === "checklist") return t("admin.documents.filter_type_checklist");
  if (kind === "safety_sign") return t("admin.documents.filter_type_safety_sign");
  return t("admin.documents.filter_type_toolbox_talk");
}

function MarkBadge({ mark, lang }: { mark: DocumentFileMark; lang: string }) {
  const label = t(
    mark === "ready"
      ? "admin.documents.mark_ready"
      : mark === "uploading"
      ? "admin.documents.mark_uploading"
      : "admin.documents.mark_missing"
  );
  const colorClass =
    mark === "ready"
      ? "bg-green-100 text-green-800"
      : mark === "uploading"
      ? "bg-yellow-100 text-yellow-800"
      : "bg-muted text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${colorClass}`}
      title={`${lang.toUpperCase()}: ${label}`}
    >
      {lang.toUpperCase()}
    </span>
  );
}

interface Props {
  rows: AdminDocumentRow[];
}

export function DocumentsTable({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center text-muted-foreground">
        <p>{t("admin.documents.empty")}</p>
        <Link
          href="/admin/documents/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {t("admin.documents.new_button")}
        </Link>
      </div>
    );
  }

  const columns: Column<AdminDocumentRow>[] = [
    {
      key: "title",
      header: t("admin.documents.col_title"),
      render: (row) => <span className="font-medium">{row.title}</span>,
    },
    {
      key: "type",
      header: t("admin.documents.col_type"),
      render: (row) => typeLabel(row.docKind),
    },
    {
      key: "category",
      header: t("admin.documents.col_category"),
      render: (row) => row.categoryName ?? "—",
    },
    {
      key: "price",
      header: t("admin.documents.col_price"),
      render: (row) => formatPriceLkr(row.priceCents),
      className: "text-right tabular-nums",
    },
    {
      key: "status",
      header: t("admin.documents.col_status"),
      render: (row) => (
        <span className="text-sm">{statusLabel(row.status)}</span>
      ),
    },
    {
      key: "langs",
      header: t("admin.documents.col_files"),
      render: (row) => (
        <div className="flex gap-1">
          {row.languageSlots.map((slot) => (
            <MarkBadge key={slot.language} mark={slot.full} lang={slot.language} />
          ))}
        </div>
      ),
    },
    {
      key: "updatedAt",
      header: t("admin.documents.col_updated"),
      render: (row) =>
        new Date(row.updatedAt).toLocaleDateString("en-LK"),
    },
    {
      key: "actions",
      header: t("admin.documents.col_actions"),
      render: (row) => (
        <Link
          href={`/admin/documents/${row.id}/edit`}
          className="text-primary underline-offset-4 hover:underline text-sm"
        >
          {t("admin.documents.edit_link")}
        </Link>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowKey={(row) => row.id}
    />
  );
}
