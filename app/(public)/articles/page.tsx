import type { Metadata } from "next";
import Link from "next/link";
import { listArticles } from "@/lib/articles/listArticles";
import { listCategories } from "@/lib/articles/listCategories";
import { ArticleFilters } from "@/components/articles/ArticleFilters";
import { ArticleGrid } from "@/components/articles/ArticleGrid";
import { t } from "@/messages/en";
import type { ArticleRange } from "@/types/article";

const VALID_RANGES: ArticleRange[] = ["newest", "week", "month"];

interface ArticlesPageProps {
  searchParams: Promise<Record<string, string>>;
}

function resolveRange(raw: string | undefined): ArticleRange {
  if (!raw) return "newest";
  return (VALID_RANGES as string[]).includes(raw) ? (raw as ArticleRange) : "newest";
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

  const [listResult, categories] = await Promise.all([
    listArticles({ range, category }),
    listCategories(),
  ]);

  const items = listResult.ok ? listResult.data.items : [];
  const next = listResult.ok ? listResult.data.next : null;

  const isEmpty = items.length === 0;
  const emptyMessage = isFiltered
    ? t("articles.empty.filtered")
    : t("articles.empty.all");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold text-gray-900">{t("articles.page.title")}</h1>

      <ArticleFilters categories={categories} />

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
  );
}
