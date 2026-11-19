"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import ArticleBody from "@/components/articles/ArticleBody";
import { ArticleLikeButton } from "@/components/articles/ArticleLikeButton";
import { publicConfig } from "@/lib/config.public";
import type { PublicArticle } from "@/types/article";

interface ArticleDrawerProps {
  article: PublicArticle;
  slug: string;
}

export function ArticleDrawer({ article, slug }: ArticleDrawerProps) {
  const router = useRouter();

  const coverUrl = article.coverImageKey
    ? `${publicConfig.mediaCdnUrl}/${article.coverImageKey}`
    : null;

  const publishedDate = new Date(article.publishedAt).toLocaleDateString("en-LK", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  function close() {
    router.back();
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {/* Blurred backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-md"
        onClick={close}
        aria-hidden="true"
      />

      {/* Centered modal container */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      >
        {/* Modal card */}
        <div
          role="dialog"
          aria-modal="true"
          aria-label={article.title}
          className="relative flex w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden"
          style={{ maxHeight: "92vh" }}
        >
          {/* Top bar: close only */}
          <div className="flex shrink-0 items-center justify-end border-b border-gray-100 bg-white px-5 py-3">
            <button
              type="button"
              onClick={close}
              aria-label="Close article"
              className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto">
            {/* Cover image */}
            {coverUrl && (
              <div className="relative h-56 w-full overflow-hidden bg-gray-900 sm:h-72">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={coverUrl}
                  alt={article.coverImageAlt ?? article.title}
                  className="h-full w-full object-cover opacity-80"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  {article.category?.name && (
                    <span className="mb-2 inline-block rounded bg-primary px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white">
                      {article.category.name}
                    </span>
                  )}
                  <h2 className="text-xl font-extrabold leading-tight text-white sm:text-2xl">
                    {article.title}
                  </h2>
                </div>
              </div>
            )}

            <div className="px-8 py-6">
              {/* Title (when no cover) */}
              {!coverUrl && (
                <div className="mb-4">
                  {article.category?.name && (
                    <span className="mb-2 inline-block rounded bg-primary px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white">
                      {article.category.name}
                    </span>
                  )}
                  <h2 className="mt-1 text-2xl font-extrabold leading-tight text-gray-900">
                    {article.title}
                  </h2>
                </div>
              )}

              {/* Author + date */}
              <div className="mb-5 flex items-center gap-3 border-b border-gray-100 pb-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                  {article.authorName?.charAt(0).toUpperCase() ?? "A"}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{article.authorName}</p>
                  <p className="text-xs text-gray-500">{publishedDate}</p>
                </div>
                <div className="ml-auto">
                  <ArticleLikeButton articleId={article.id} slug={slug} initialCount={article.likeCount} />
                </div>
              </div>

              {/* Excerpt */}
              {article.excerpt && (
                <p className="mb-5 border-l-4 border-primary pl-4 text-base font-medium leading-relaxed text-gray-700">
                  {article.excerpt}
                </p>
              )}

              {/* Body */}
              <div className="article-body">
                <ArticleBody body={article.body} />
              </div>

              {/* Footer */}
              <div className="mt-8 border-t border-gray-100 pb-4 pt-5">
                <ArticleLikeButton articleId={article.id} slug={slug} initialCount={article.likeCount} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
