import type { Metadata } from "next";
import Link from "next/link";
import { listArticles } from "@/lib/articles/listArticles";
import { listCategories } from "@/lib/articles/listCategories";
import { ArticleFilters } from "@/components/articles/ArticleFilters";
import { ArticleGrid } from "@/components/articles/ArticleGrid";
import { ArticleCardUI } from "@/components/articles/ArticleCard";
import { ArticlesHeroSlideshow } from "@/components/articles/ArticlesHeroSlideshow";
import { HeroSearchForm } from "@/components/articles/HeroSearchForm";
import { t } from "@/messages/en";
import { publicConfig } from "@/lib/config.public";
import { ARTICLE_RANGES } from "@/types/article";
import type { ArticleRange } from "@/types/article";

function coverUrl(key: string | null): string | undefined {
  if (!key) return undefined;
  return `${publicConfig.mediaCdnUrl}/${key}`;
}

interface ArticlesPageProps {
  searchParams: Promise<Record<string, string>>;
}

function resolveRange(raw: string | undefined): ArticleRange {
  if (!raw) return "newest";
  return (ARTICLE_RANGES as string[]).includes(raw) ? (raw as ArticleRange) : "newest";
}

export async function generateMetadata({
  searchParams,
}: ArticlesPageProps): Promise<Metadata> {
  const params = await searchParams;
  const isFiltered = Boolean(params.range || params.category);
  return {
    title: t("articles.page.title"),
    description: t("articles.page.description"),
    ...(isFiltered ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function ArticlesPage({ searchParams }: ArticlesPageProps) {
  const params = await searchParams;
  const range = resolveRange(params.range);
  const category = params.category || undefined;
  const isFiltered = range !== "newest" || Boolean(category);

  const popularIsSameQuery = range === "month" && !category;

  const [listResult, categories, popularResult] = await Promise.all([
    listArticles({ range, category }),
    listCategories(),
    popularIsSameQuery ? Promise.resolve(null) : listArticles({ range: "month" }),
  ]);

  const items = listResult.ok ? listResult.data.items : [];
  const next = listResult.ok ? listResult.data.next : null;
  const popularItems = popularIsSameQuery
    ? (listResult.ok ? listResult.data.items.slice(0, 5) : [])
    : (popularResult?.ok ? popularResult.data.items.slice(0, 5) : []);

  const isEmpty = items.length === 0;
  const emptyMessage = isFiltered
    ? t("articles.empty.filtered")
    : t("articles.empty.all");

  return (
    <div>
      {/* Knowledge Hub Hero Banner */}
      <div className="relative overflow-hidden bg-gray-900">
        <ArticlesHeroSlideshow />

        <div className="relative mx-auto max-w-6xl px-4 py-14 text-white">
          <div className="max-w-2xl">
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-red-300">
              Ceylon Safety
            </p>
            <h1 className="mb-3 text-4xl font-extrabold tracking-tight sm:text-5xl">
              {t("articles.hub.title")}
            </h1>
            <p className="mb-8 text-sm text-gray-300 sm:text-base">
              {t("articles.hub.subtitle")}
            </p>

            {/* Hero search bar */}
            <HeroSearchForm />
          </div>
        </div>
      </div>

      {/* Filters + Grid */}
      <div className="mx-auto max-w-6xl px-4 py-8">
        <ArticleFilters categories={categories} />

        {/* Result count */}
        {!isEmpty && (
          <p className="mb-4 text-sm text-gray-500">
            {t("articles.results.count", { count: String(items.length + (next ? "+": "")) })}
          </p>
        )}

        {isFiltered && !isEmpty && (
          <div className="mb-4 flex justify-end">
            <Link
              href="/articles"
              className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
            >
              {t("articles.filter.clear")}
            </Link>
          </div>
        )}

        {isEmpty ? (
          <div className="mt-10 flex flex-col items-center gap-4 text-center text-gray-500">
            <p>{emptyMessage}</p>
            {isFiltered && (
              <Link
                href="/articles"
                className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
              >
                {t("articles.filter.clear")}
              </Link>
            )}
          </div>
        ) : (
          <ArticleGrid
            initialItems={items}
            initialNext={next}
            range={range}
            category={category}
          />
        )}
      </div>

      {/* Popular Last Month Section */}
      {popularItems.length > 0 && (
        <div className="border-t border-gray-100 bg-gray-50 py-10">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="mb-6 text-lg font-bold text-gray-900">
              {t("articles.popular.heading")}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {popularItems.map((item) => (
                <ArticleCardUI
                  key={item.id}
                  slug={item.slug}
                  title={item.title}
                  excerpt={item.excerpt}
                  coverUrl={coverUrl(item.coverImageKey)}
                  coverAlt={item.coverImageAlt ?? undefined}
                  categoryName={item.category.name}
                  authorName={item.authorName}
                  publishedAt={item.publishedAt}
                  likeCount={item.likeCount}
                  commentCount={item.commentCount}
                  compact
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
