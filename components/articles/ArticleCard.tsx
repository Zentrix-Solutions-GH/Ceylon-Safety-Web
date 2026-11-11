import Link from "next/link";
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
}: ArticleCardUIProps) {
  const imgSrc = coverUrl ?? PLACEHOLDER;
  const imgAlt = coverAlt ?? title;

  return (
    <Link
      href={`/articles/${slug}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition hover:shadow-md"
    >
      <div className="relative aspect-video overflow-hidden bg-gray-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imgSrc}
          alt={imgAlt}
          loading="lazy"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 480px"
          className="h-full w-full object-cover transition group-hover:scale-105"
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = PLACEHOLDER; }}
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
