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
  /** Large vertical card for home feed (deprecated) */
  large?: boolean;
  /** Horizontal compact card: small image left, content right */
  horizontal?: boolean;
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
  large = false,
  horizontal = false,
}: ArticleCardUIProps) {
  const [imgSrc, setImgSrc] = useState(coverUrl ?? PLACEHOLDER);
  const imgAlt = coverAlt ?? title;

  if (large) {
    return (
      <Link
        href={`/articles/${slug}`}
        className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-md transition hover:shadow-xl"
      >
        {/* Full-width image with overlaid category badge */}
        <div className="relative w-full overflow-hidden bg-gray-900">
          <div className="aspect-[16/9]">
            <Image
              src={imgSrc}
              alt={imgAlt}
              fill
              unoptimized
              className="object-cover transition duration-300 group-hover:scale-105"
              onError={() => setImgSrc(PLACEHOLDER)}
            />
            {/* Dark gradient at bottom for readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
          </div>
          {/* Category badge overlaid top-left */}
          {categoryName && (
            <span className="absolute left-4 top-4 rounded bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white shadow">
              {categoryName}
            </span>
          )}
        </div>

        {/* Content below image */}
        <div className="flex flex-1 flex-col gap-3 p-5 sm:p-6">
          <h2 className="line-clamp-2 text-lg font-extrabold leading-snug text-gray-900 transition-colors group-hover:text-primary sm:text-xl">
            {title}
          </h2>
          {excerpt && (
            <p className="line-clamp-2 text-sm leading-relaxed text-gray-500">{excerpt}</p>
          )}

          {/* Author row + stats */}
          <div className="mt-auto flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              {/* Author avatar */}
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-white">
                {authorName ? authorName.charAt(0).toUpperCase() : "C"}
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-700">{authorName || "Ceylon Safety"}</p>
                <p className="text-[10px] text-gray-400">{formatDate(publishedAt)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                {likeCount}
              </span>
              <span className="flex items-center gap-1">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                {commentCount}
              </span>
            </div>
          </div>
        </div>
      </Link>
    );
  }

  if (horizontal) {
    return (
      <Link
        href={`/articles/${slug}`}
        className="group flex gap-3 overflow-hidden rounded-xl bg-white p-3 shadow-sm transition hover:shadow-md sm:gap-4 sm:p-4"
      >
        {/* Thumbnail */}
        <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-gray-100 sm:h-24 sm:w-36">
          <Image
            src={imgSrc}
            alt={imgAlt}
            fill
            unoptimized
            className="object-cover transition duration-300 group-hover:scale-105"
            onError={() => setImgSrc(PLACEHOLDER)}
          />
        </div>

        {/* Content */}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {categoryName && (
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
              {categoryName}
            </span>
          )}
          <h2 className="line-clamp-2 text-sm font-bold leading-snug text-gray-900 transition-colors group-hover:text-primary sm:text-base">
            {title}
          </h2>
          {excerpt && (
            <p className="line-clamp-1 text-xs leading-relaxed text-gray-500">{excerpt}</p>
          )}
          <div className="mt-auto flex items-center gap-2 pt-1 text-[10px] text-gray-400">
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-white">
              {authorName ? authorName.charAt(0).toUpperCase() : "C"}
            </div>
            <span className="font-medium text-gray-600">{authorName || "Ceylon Safety"}</span>
            <span>·</span>
            <span>{formatDate(publishedAt)}</span>
            <span className="ml-auto flex items-center gap-2">
              <span className="flex items-center gap-0.5">
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                {likeCount}
              </span>
              <span className="flex items-center gap-0.5">
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                {commentCount}
              </span>
            </span>
          </div>
        </div>
      </Link>
    );
  }

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
