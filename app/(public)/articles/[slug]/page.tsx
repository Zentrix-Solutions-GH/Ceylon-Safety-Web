import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getArticle } from "@/lib/articles/getArticle";
import { createSupabaseAnonClient } from "@/lib/supabase/server";
import ArticleBody from "@/components/articles/ArticleBody";
import { t } from "@/messages/en";
import { publicConfig } from "@/lib/config.public";

interface Props {
  params: Promise<{ slug: string }>;
}

/** Look up slug_redirects; returns new_slug or null. At most one hop (EC3). */
async function findRedirect(oldSlug: string): Promise<string | null> {
  const supabase = createSupabaseAnonClient();
  const { data } = await supabase
    .from("slug_redirects")
    .select("new_slug")
    .eq("old_slug", oldSlug)
    .eq("entity_type", "article")
    .maybeSingle();
  return (data as { new_slug: string } | null)?.new_slug ?? null;
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
    // Check slug_redirects before 404
    const newSlug = await findRedirect(slug);
    if (newSlug) {
      redirect(`/articles/${newSlug}`);
    }
    notFound();
  }

  const article = result.data;

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
    </article>
  );
}

// 300 s CDN cache. purge-on-publish via revalidateTag requires the fetch to be
// tagged with unstable_cache/cacheTag — not yet wired; only the TTL applies today.
export const revalidate = 300;
export function generateStaticParams() {
  return [];
}
