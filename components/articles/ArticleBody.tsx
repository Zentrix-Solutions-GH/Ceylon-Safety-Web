import { renderArticleBody } from "@/lib/content/render";
import type { ArticleBody as ArticleBodyType } from "@/types/article";

interface ArticleBodyProps {
  body: ArticleBodyType;
}

export default function ArticleBody({ body }: ArticleBodyProps) {
  return renderArticleBody(body);
}
