import { renderArticleBody } from "@/lib/content/render";
import type { ArticleBody as ArticleBodyType, ResolvedVideoNode } from "@/types/article";

interface ArticleBodyProps {
  body: ArticleBodyType;
  resolvedVideos?: ResolvedVideoNode[];
}

export default function ArticleBody({ body, resolvedVideos }: ArticleBodyProps) {
  return renderArticleBody(body, resolvedVideos);
}
