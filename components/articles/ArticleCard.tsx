"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { t } from "@/messages/en";

const PLACEHOLDER = "/images/article-placeholder.jpg";

export interface ArticleCardUIProps {
  slug: string;
  title: string;
  excerpt: string | null;
  coverUrl?: string;
  coverAlt?: string;
  categoryName?: string;
  authorName: string;
  publishedAt: string;
  likeCount: number;
  commentCount: number;
  /** Compact variant used in Popular Last Month strip */
  compact?: boolean;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-LK", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function ArticleCardUI({
  slug,
  title,
  excerpt,
  coverUrl,
  coverAlt,
  categoryName,
  authorName,
  publishedAt,
  likeCount,
  commentCount,
  compact = false,
}: ArticleCardUIProps) {
  const [imgSrc, setImgSrc] = useState(coverUrl ?? PLACEHOLDER);
  const imgAlt = coverAlt ?? title;

  if (compact) {
    return (
      <Link
        href={`/articles/${slug}`}
        className="group flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition hover:shadow-md"
      >
        <div className="relative aspect-video overflow-hidden bg-gray-100">
          <Image
            src={imgSrc}
            alt={imgAlt}
            fill
            unoptimized
            className="object-cover transition group-hover:scale-105"
            onError={() => setImgSrc(PLACEHOLDER)}
          />
        </div>
        <div className="flex flex-1 flex-col gap-1 p-3">
          {categoryName && (
            <span className="text-[10px] font-semibold uppercase tracking-wide text-red-600">
              {categoryName}
            </span>
          )}
          <h3 className="line-clamp-2 text-xs font-bold text-gray-900 leading-snug">{title}</h3>
          <p className="mt-auto text-[10px] text-gray-400">{formatDate(publishedAt)}</p>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/articles/${slug}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition hover:shadow-md"
    >
      <div className="relative aspect-video overflow-hidden bg-gray-100">
        <Image
          src={imgSrc}
          alt={imgAlt}
          fill
          unoptimized
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 480px"
          className="object-cover transition group-hover:scale-105"
          onError={() => setImgSrc(PLACEHOLDER)}
        />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        {categoryName && (
          <span className="text-xs font-semibold uppercase tracking-wide text-red-600">
            {categoryName}
          </span>
        )}
        <h2 className="line-clamp-2 text-base font-bold text-gray-900">{title}</h2>
        {excerpt && (
          <p className="line-clamp-3 text-sm text-gray-600">{excerpt}</p>
        )}
        <div className="mt-auto flex items-center justify-between pt-2 text-xs text-gray-500">
          <span>{authorName}</span>
          <span>{formatDate(publishedAt)}</span>
        </div>
        <div className="flex gap-3 text-xs text-gray-400">
          <span aria-label={t("articles.card.likes", { count: String(likeCount) })}>
            {likeCount}
          </span>
          <span aria-label={t("articles.card.comments", { count: String(commentCount) })}>
            {commentCount}
          </span>
        </div>
      </div>
    </Link>
  );
}
