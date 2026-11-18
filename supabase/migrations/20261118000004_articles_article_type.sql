-- S-059 follow-up: add article_type to articles table for type filter
-- Types: article (default), guide, news, tip

ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS article_type text NOT NULL DEFAULT 'article';

ALTER TABLE public.articles
  ADD CONSTRAINT articles_article_type_check
  CHECK (article_type IN ('article', 'guide', 'news', 'tip'));

COMMENT ON COLUMN public.articles.article_type IS
  'Content format type. article = general content; guide = how-to; news = industry news; tip = safety tip.';

-- Index for filter queries
CREATE INDEX IF NOT EXISTS idx_articles_article_type
  ON public.articles (article_type)
  WHERE deleted_at IS NULL;
