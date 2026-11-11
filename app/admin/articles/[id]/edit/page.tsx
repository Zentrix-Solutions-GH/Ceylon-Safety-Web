import { notFound, redirect } from "next/navigation";
import { getArticleForEdit } from "@/lib/articles/getArticleForEdit";
import { listAuthors } from "@/lib/authors/actions/listAuthors";
import { listCategories } from "@/lib/articles/listCategories";
import ArticleEditor from "@/components/admin/ArticleEditor/index";

export default async function ArticleEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [articleResult, authorsResult, categories] = await Promise.all([
    getArticleForEdit(id),
    listAuthors({ includeInactive: true }),
    listCategories(),
  ]);

  if (!articleResult.ok) {
    if (articleResult.code === "not_found") notFound();
    redirect("/admin/articles");
  }

  if (!authorsResult.ok) redirect("/admin/articles");

  return (
    <ArticleEditor
      initialData={articleResult.data}
      authors={authorsResult.authors}
      categories={categories}
    />
  );
}
