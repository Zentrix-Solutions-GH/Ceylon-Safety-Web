"use client";

import { t } from "@/messages/en";
import type { ArticleStatus } from "@/types/article";

type DisplayStatus = ArticleStatus | "scheduled";

const BADGE_STYLES: Record<DisplayStatus, string> = {
  draft: "bg-gray-100 text-gray-700",
  scheduled: "bg-blue-100 text-blue-700",
  published: "bg-green-100 text-green-700",
  hidden: "bg-yellow-100 text-yellow-700",
};

const STATUS_LABELS: Record<DisplayStatus, string> = {
  draft: t("admin.articles.status_draft"),
  scheduled: t("admin.articles.status_scheduled"),
  published: t("admin.articles.status_published"),
  hidden: t("admin.articles.status_hidden"),
};

interface Props {
  status: DisplayStatus;
  "data-testid"?: string;
}

export default function ArticleStatusBadge({ status, "data-testid": testId }: Props) {
  const style = BADGE_STYLES[status] ?? "bg-gray-100 text-gray-700";
  const label = STATUS_LABELS[status] ?? status;
  return (
    <span
      data-testid={testId}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${style}`}
    >
      {label}
    </span>
  );
}
