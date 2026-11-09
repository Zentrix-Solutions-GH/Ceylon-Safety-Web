-- S-064: search_all integration tests
-- AC3: cap 50, ranking order
-- AC4: visibility — draft/hidden/scheduled/deleted never returned

BEGIN;

SELECT plan(10);

-- ── Helpers ──────────────────────────────────────────────────────────────────

-- Insert a known published article into a category so search_all can find it.
DO $$
BEGIN
  -- category
  INSERT INTO public.categories (id, name, slug, kind)
  VALUES ('99000001-0000-4000-8000-000000000001', 'S064 Test', 's064-test', 'article')
  ON CONFLICT (id) DO NOTHING;

  -- author
  INSERT INTO public.authors (id, display_name, slug, is_active)
  VALUES ('99000001-0000-4000-8000-000000000002', 'S064 Author', 's064-author', true)
  ON CONFLICT (id) DO NOTHING;

  -- published article
  INSERT INTO public.articles (id, slug, title, excerpt, status, published_at, author_id, category_id, search_vector)
  VALUES (
    '99000001-0000-4000-8000-000000000003',
    's064-published', 'S064 Published Article', 'Test excerpt for s064',
    'published', now() - interval '1 hour',
    '99000001-0000-4000-8000-000000000002',
    '99000001-0000-4000-8000-000000000001',
    to_tsvector('english', 'S064 Published Article Test excerpt for s064')
  ) ON CONFLICT (id) DO NOTHING;

  -- draft article (should NOT appear)
  INSERT INTO public.articles (id, slug, title, excerpt, status, published_at, author_id, category_id, search_vector)
  VALUES (
    '99000001-0000-4000-8000-000000000004',
    's064-draft', 'S064 Draft Article', 'Draft excerpt',
    'draft', now() - interval '1 hour',
    '99000001-0000-4000-8000-000000000002',
    '99000001-0000-4000-8000-000000000001',
    to_tsvector('english', 'S064 Draft Article Draft excerpt')
  ) ON CONFLICT (id) DO NOTHING;

  -- hidden article (should NOT appear)
  INSERT INTO public.articles (id, slug, title, excerpt, status, published_at, author_id, category_id, search_vector)
  VALUES (
    '99000001-0000-4000-8000-000000000005',
    's064-hidden', 'S064 Hidden Article', 'Hidden excerpt',
    'hidden', now() - interval '1 hour',
    '99000001-0000-4000-8000-000000000002',
    '99000001-0000-4000-8000-000000000001',
    to_tsvector('english', 'S064 Hidden Article Hidden excerpt')
  ) ON CONFLICT (id) DO NOTHING;

  -- scheduled (future published_at) article (should NOT appear)
  INSERT INTO public.articles (id, slug, title, excerpt, status, published_at, author_id, category_id, search_vector)
  VALUES (
    '99000001-0000-4000-8000-000000000006',
    's064-scheduled', 'S064 Scheduled Article', 'Scheduled excerpt',
    'published', now() + interval '1 hour',
    '99000001-0000-4000-8000-000000000002',
    '99000001-0000-4000-8000-000000000001',
    to_tsvector('english', 'S064 Scheduled Article Scheduled excerpt')
  ) ON CONFLICT (id) DO NOTHING;

  -- soft-deleted article (should NOT appear)
  INSERT INTO public.articles (id, slug, title, excerpt, status, published_at, deleted_at, author_id, category_id, search_vector)
  VALUES (
    '99000001-0000-4000-8000-000000000007',
    's064-deleted', 'S064 Deleted Article', 'Deleted excerpt',
    'published', now() - interval '1 hour', now() - interval '30 minutes',
    '99000001-0000-4000-8000-000000000002',
    '99000001-0000-4000-8000-000000000001',
    to_tsvector('english', 'S064 Deleted Article Deleted excerpt')
  ) ON CONFLICT (id) DO NOTHING;
END $$;

-- ── AC4: visibility filter ────────────────────────────────────────────────────

SELECT is(
  (SELECT count(*)::int FROM public.search_all('S064 Published Article', 'articles', 50)
   WHERE kind = 'article'),
  1,
  'AC4: published article is returned'
);

SELECT is(
  (SELECT count(*)::int FROM public.search_all('S064 Draft Article', 'articles', 50)
   WHERE kind = 'article'),
  0,
  'AC4: draft article is not returned'
);

SELECT is(
  (SELECT count(*)::int FROM public.search_all('S064 Hidden Article', 'articles', 50)
   WHERE kind = 'article'),
  0,
  'AC4: hidden article is not returned'
);

SELECT is(
  (SELECT count(*)::int FROM public.search_all('S064 Scheduled Article', 'articles', 50)
   WHERE kind = 'article'),
  0,
  'AC4: scheduled (future published_at) article is not returned'
);

SELECT is(
  (SELECT count(*)::int FROM public.search_all('S064 Deleted Article', 'articles', 50)
   WHERE kind = 'article'),
  0,
  'AC4: soft-deleted article is not returned'
);

-- ── AC3: result cap ───────────────────────────────────────────────────────────

-- Insert 60 published articles with the same title prefix to test the 50-cap
DO $$
DECLARE
  i int;
BEGIN
  FOR i IN 1..60 LOOP
    INSERT INTO public.articles (id, slug, title, excerpt, status, published_at, author_id, category_id, search_vector)
    VALUES (
      ('99000002-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
      's064-cap-' || i, 'S064 CapTest Article ' || i, 'cap excerpt',
      'published', now() - interval '1 hour',
      '99000001-0000-4000-8000-000000000002',
      '99000001-0000-4000-8000-000000000001',
      to_tsvector('english', 'S064 CapTest Article cap excerpt')
    ) ON CONFLICT (id) DO NOTHING;
  END LOOP;
END $$;

SELECT is(
  (SELECT count(*)::int FROM public.search_all('S064 CapTest Article', 'articles', 50)),
  50,
  'AC3: at most 50 results returned'
);

-- ── AC6: file_key absent ──────────────────────────────────────────────────────

-- search_all RETURNS TABLE does not include file_key; verify by checking column list
SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM information_schema.routines r
    JOIN information_schema.parameters p ON p.specific_name = r.specific_name
    WHERE r.routine_schema = 'public'
      AND r.routine_name = 'search_all'
      AND p.parameter_mode = 'OUT'
      AND p.parameter_name = 'file_key'
  ),
  'AC6: search_all RETURNS TABLE does not include file_key'
);

-- ── AC1: scope filters ────────────────────────────────────────────────────────

SELECT is(
  (SELECT count(*)::int FROM public.search_all('S064 Published Article', 'documents', 50)),
  0,
  'AC1: articles scope=documents does not return articles'
);

SELECT is(
  (SELECT count(*)::int FROM public.search_all('S064 Published Article', 'articles', 50)),
  1,
  'AC1: articles scope=articles returns articles'
);

SELECT is(
  (SELECT count(*)::int FROM public.search_all('S064 Published Article', 'all', 50)
   WHERE kind = 'article'),
  1,
  'AC1: scope=all returns articles'
);

SELECT * FROM finish();

ROLLBACK;
