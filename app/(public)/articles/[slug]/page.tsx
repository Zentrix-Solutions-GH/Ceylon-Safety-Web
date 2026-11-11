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
  // Fetch approved comments server-side using anon client (no session read)
  const firstCommentPage = await listComments(article.id, null).catch(() => ({
    comments: [],
    nextCursor: null,
  }));

  return (
    <article>
      <nav aria-label={t("article.back_to_articles")}>
        <Link href="/articles">{t("article.back_to_articles")}</Link>
      </nav>

      <header>
        {article.coverImageKey && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`${publicConfig.mediaCdnUrl}/${article.coverImageKey}`}
            alt={article.coverImageAlt ?? ""}
          />
        )}
        <h1>{article.title}</h1>
        {article.excerpt && <p>{article.excerpt}</p>}
        <p>
          <span>{article.authorName}</span>
          {" · "}
          <time dateTime={article.publishedAt}>
            {new Date(article.publishedAt).toLocaleDateString("en-LK", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </time>
        </p>
      </header>

      <ArticleBody body={article.body} />
      <ArticleLikeButton articleId={article.id} slug={slug} initialCount={article.likeCount} />
      <CommentForm articleId={article.id} />
      <CommentThread
        articleId={article.id}
        initialComments={firstCommentPage.comments}
        initialNextCursor={firstCommentPage.nextCursor}
      />
    </article>
  );
}

// 300 s CDN cache. purge-on-publish via revalidateTag requires the fetch to be
// tagged with unstable_cache/cacheTag — not yet wired; only the TTL applies today.
export const revalidate = 300;
export function generateStaticParams() {
  return [];
}
