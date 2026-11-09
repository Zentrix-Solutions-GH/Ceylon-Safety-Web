-- S-064: public.search_all — full-text search across articles and documents.
-- Runs with the CALLER's rights (no SECURITY DEFINER) so RLS enforces visibility.
-- scope: 'all' (home page), 'articles', 'documents'.
-- lim: result cap (always 50 from the app layer).
-- A statement timeout of 2 s is set locally for the duration of the call.

CREATE OR REPLACE FUNCTION public.search_all(
  query  text,
  scope  text,
  lim    int DEFAULT 50
)
RETURNS TABLE (
  kind             text,
  id               uuid,
  slug             text,
  title            text,
  short_text       text,
  cover_image_key  text,
  category_name    text
)
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
AS $$
DECLARE
  _tsq tsquery;
BEGIN
  -- 2-second statement timeout for this call only
  PERFORM set_config('statement_timeout', '2000', true);

  -- Parse with websearch_to_tsquery; treat a parse error as an empty result.
  BEGIN
    _tsq := websearch_to_tsquery('english', query);
  EXCEPTION WHEN OTHERS THEN
    RETURN;
  END;

  RETURN QUERY
  SELECT
    q.kind,
    q.id,
    q.slug,
    q.title,
    q.short_text,
    q.cover_image_key,
    q.category_name
  FROM (
    -- Articles branch
    SELECT
      'article'::text                                              AS kind,
      a.id,
      a.slug,
      a.title,
      LEFT(COALESCE(a.excerpt, ''), 200)                          AS short_text,
      a.cover_image_key::text                                     AS cover_image_key,
      c.name                                                      AS category_name,
      ts_rank(a.search_vector, _tsq)                              AS rank
    FROM   public.articles a
    LEFT   JOIN public.categories c ON c.id = a.category_id
    WHERE  (scope = 'all' OR scope = 'articles')
      AND  a.status = 'published'
      AND  a.published_at <= now()
      AND  a.deleted_at IS NULL
      AND  a.search_vector @@ _tsq

    UNION ALL

    -- Documents branch
    SELECT
      'document'::text                                            AS kind,
      d.id,
      d.slug,
      d.title,
      LEFT(COALESCE(d.description, ''), 200)                     AS short_text,
      d.cover_image_key::text                                     AS cover_image_key,
      c.name                                                      AS category_name,
      ts_rank(d.search_vector, _tsq)                             AS rank
    FROM   public.documents d
    LEFT   JOIN public.categories c ON c.id = d.category_id
    WHERE  (scope = 'all' OR scope = 'documents')
      AND  d.status = 'published'
      AND  d.published_at <= now()
      AND  d.deleted_at IS NULL
      AND  d.search_vector @@ _tsq
  ) q
  ORDER BY q.rank DESC
  LIMIT lim;
END;
$$;

-- Allow anon and authenticated to call the function
GRANT EXECUTE ON FUNCTION public.search_all(text, text, int) TO anon, authenticated;
