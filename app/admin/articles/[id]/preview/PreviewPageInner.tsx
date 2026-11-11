"use client";

import { t } from "@/messages/en";
import ArticleBody from "@/components/ArticleBody";
import type { ArticlePreviewData } from "@/types/article";

interface Props {
  data: ArticlePreviewData;
}

export default function PreviewPageInner({ data }: Props) {
  return (
    <div className="space-y-6">
      <div
        data-testid="preview-banner"
        className="rounded-md bg-yellow-100 px-4 py-2 text-sm font-semibold text-yellow-800 text-center"
      >
        {t("admin.articles.preview_banner")}
      </div>

      {data.coverImageKey && data.coverImageStatus === "pending" && (
        <div
          data-testid="cover-image-pending-notice"
          className="rounded-md bg-orange-50 border border-orange-200 px-4 py-2 text-sm text-orange-700"
        >
          {t("admin.articles.preview_cover_pending")}
        </div>
      )}

      <h1 className="text-3xl font-bold">{data.title}</h1>

      <ArticleBody body={data.body} />
    </div>
  );
}
