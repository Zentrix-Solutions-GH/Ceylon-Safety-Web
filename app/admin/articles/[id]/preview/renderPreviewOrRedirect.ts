import { redirect } from "next/navigation";
import { getArticlePreview } from "@/lib/articles/getArticlePreview";
import type { ArticlePreviewData } from "@/types/article";

export async function renderPreviewOrRedirect(id: string): Promise<ArticlePreviewData> {
  const result = await getArticlePreview(id);

  if (!result.ok) {
    if (result.code === "not_allowed") redirect("/admin");
    redirect("/admin/articles");
  }

  return result.data;
}
