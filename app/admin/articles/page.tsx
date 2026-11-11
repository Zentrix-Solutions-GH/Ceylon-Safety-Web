import { redirect } from "next/navigation";
import { listAdminArticles } from "@/lib/articles/listAdminArticles";
import { listCategories } from "@/lib/articles/listCategories";
import ArticlesPageClient, { type FilterStatus } from "./ArticlesPageClient";
import type { ArticleStatus } from "@/types/article";

type SearchParams = { status?: string; category?: string; title?: string; page?: string };

export default async function AdminArticlesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  const status = params.status as ArticleStatus | "scheduled" | undefined;
  const rawPage = params.page ? parseInt(params.page, 10) : 1;
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1;

  const [articlesResult, categories] = await Promise.all([
    listAdminArticles({
      status,
      category: params.category,
      title: params.title,
      page,
    }),
    listCategories(),
  ]);

  if (!articlesResult.ok) {
    if (articlesResult.code === "not_allowed") redirect("/admin");
    redirect("/admin/articles");
  }

  return (
    <ArticlesPageClient
      initialArticles={articlesResult.data.items}
      pageCount={articlesResult.data.pageCount}
      currentPage={page}
      categories={categories}
      initialStatus={(params.status ?? "") as FilterStatus}
      initialCategory={params.category ?? ""}
      initialTitle={params.title ?? ""}
    />
  );
}
