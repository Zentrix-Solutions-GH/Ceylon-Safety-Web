import { getArticle } from "@/lib/articles/getArticle";
import { ArticleDrawer } from "@/components/articles/ArticleDrawer";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function ArticleModalPage({ params }: Props) {
  const { slug } = await params;
  const result = await getArticle(slug);

  // If article not found or redirect, render nothing — the full page handles it.
  if (!result.ok) return null;

  return <ArticleDrawer article={result.data} slug={slug} />;
}
