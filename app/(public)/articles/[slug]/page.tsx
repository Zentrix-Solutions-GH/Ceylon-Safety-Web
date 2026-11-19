import { notFound, permanentRedirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getArticle } from "@/lib/articles/getArticle";
import ArticleBody from "@/components/articles/ArticleBody";
import { ArticleLikeButton } from "@/components/articles/ArticleLikeButton";
import { CommentForm } from "@/components/articles/CommentForm";
import { CommentThread } from "@/components/articles/CommentThread";
import { t } from "@/messages/en";
import { publicConfig } from "@/lib/config.public";
import { listComments } from "@/lib/engagement/listComments";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const result = await getArticle(slug);

  if (!result.ok) {
    return { robots: { index: false, follow: false } };
  }

  const { title, excerpt, seoTitle, seoDescription, coverImageKey } = result.data;
  const pageTitle = seoTitle ?? title;
  const description = seoDescription ?? excerpt ?? undefined;
  const canonicalUrl = `${publicConfig.appUrl}/articles/${slug}`;
  const ogImage = coverImageKey ? `${publicConfig.mediaCdnUrl}/${coverImageKey}` : undefined;

  return {
    title: pageTitle,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: pageTitle,
      description,
      ...(ogImage ? { images: [{ url: ogImage }] } : {}),
    },
  };
}

export default async function ArticleSlugPage({ params }: Props) {
  const { slug } = await params;
  const result = await getArticle(slug);

  if (!result.ok) {
    if (result.code === "redirect") {
      permanentRedirect(`/articles/${result.newSlug}`);
    }
    notFound();
  }

  const article = result.data;
  const firstCommentPage = await listComments(article.id, null).catch(() => ({
    comments: [],
    nextCursor: null,
  }));

  const coverUrl = article.coverImageKey
    ? `${publicConfig.mediaCdnUrl}/${article.coverImageKey}`
    : null;

  const publishedDate = new Date(article.publishedAt).toLocaleDateString("en-LK", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="bg-white">
      {/* Cover image hero */}
      {coverUrl && (
        <div className="relative h-72 w-full overflow-hidden bg-gray-900 sm:h-96 lg:h-[480px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverUrl}
            alt={article.coverImageAlt ?? article.title}
            className="h-full w-full object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-10">
            <div className="mx-auto max-w-3xl">
              {article.category?.name && (
                <span className="mb-3 inline-block rounded bg-primary px-2.5 py-0.5 text-xs font-bold uppercase tracking-widest text-white">
                  {article.category.name}
                </span>
              )}
              <h1 className="text-2xl font-extrabold leading-tight text-white sm:text-3xl lg:text-4xl">
                {article.title}
              </h1>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {/* Breadcrumb */}
        <nav aria-label={t("article.back_to_articles")} className="mb-6">
          <Link
            href="/articles"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary transition-colors"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t("article.back_to_articles")}
          </Link>
        </nav>

        {/* Article header (when no cover) */}
        {!coverUrl && (
          <header className="mb-8">
            {article.category?.name && (
              <span className="mb-3 inline-block rounded bg-primary px-2.5 py-0.5 text-xs font-bold uppercase tracking-widest text-white">
                {article.category.name}
              </span>
            )}
            <h1 className="mb-3 text-3xl font-extrabold leading-tight text-gray-900 sm:text-4xl">
              {article.title}
            </h1>
          </header>
        )}

        {/* Meta row: author + date + read time */}
        <div className="mb-8 flex flex-wrap items-center gap-3 border-b border-gray-100 pb-6">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-sm text-white">
            {article.authorName?.charAt(0).toUpperCase() ?? "A"}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{article.authorName}</p>
            <p className="text-xs text-gray-500">{publishedDate}</p>
          </div>
          <div className="ml-auto flex items-center gap-4 text-xs text-gray-400">
            <ArticleLikeButton articleId={article.id} slug={slug} initialCount={article.likeCount} />
          </div>
        </div>

        {/* Excerpt / lead paragraph */}
        {article.excerpt && (
          <p className="mb-8 text-lg font-medium leading-relaxed text-gray-700 border-l-4 border-primary pl-4">
            {article.excerpt}
          </p>
        )}

        {/* Body */}
        <div className="article-body">
          <ArticleBody body={article.body} />
        </div>

        {/* Bottom like + share */}
        <div className="mt-10 flex items-center justify-between border-t border-gray-100 pt-6">
          <ArticleLikeButton articleId={article.id} slug={slug} initialCount={article.likeCount} />
          <Link
            href="/articles"
            className="text-sm font-medium text-primary hover:underline"
          >
            ← More articles
          </Link>
        </div>

        {/* Comments */}
        <div className="mt-10 border-t border-gray-100 pt-8">
          <h2 className="mb-6 text-lg font-bold text-gray-900">Comments</h2>
          <CommentForm articleId={article.id} />
          <div className="mt-8">
            <CommentThread
              articleId={article.id}
              initialComments={firstCommentPage.comments}
              initialNextCursor={firstCommentPage.nextCursor}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export const revalidate = 300;
export function generateStaticParams() {
  return [];
}
