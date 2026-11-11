import { redirect } from "next/navigation";
import { listAdminArticles } from "@/lib/articles/listAdminArticles";
import { listCategories } from "@/lib/articles/listCategories";
import ArticlesPageClient from "./ArticlesPageClient";
import type { ArticleStatus } from "@/types/article";

type SearchParams = { status?: string; category?: string; title?: string; page?: string };

export default async function AdminArticlesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  const status = params.status as ArticleStatus | "scheduled" | undefined;
  const page = params.page ? parseInt(params.page, 10) : 1;

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
    redirect("/admin");
  }

  return (
    <ArticlesPageClient
      initialArticles={articlesResult.data.items}
      pageCount={articlesResult.data.pageCount}
      categories={categories}
    />
  );
}
