-- S-064: search_all integration tests
-- AC1: scope filters
-- AC3: cap 50
-- AC4: visibility — draft/hidden/scheduled/deleted never returned
-- AC6: file_key absent from function signature

BEGIN;

SELECT plan(16);

-- ── Seed helpers ─────────────────────────────────────────────────────────────

INSERT INTO public.categories (id, slug, name, applies_to)
VALUES ('99000001-0000-4000-8000-000000000001', 's064-test', 'S064 Test', ARRAY['article']::text[])
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.authors (id, slug, name, is_active)
VALUES ('99000001-0000-4000-8000-000000000002', 's064-author', 'S064 Author', true)
ON CONFLICT (id) DO NOTHING;

-- published article (should appear)
INSERT INTO public.articles (id, locale, slug, title, excerpt, body, body_version, status, published_at, author_id, category_id, search_vector)
VALUES (
  '99000001-0000-4000-8000-000000000003',
  'en', 's064-published', 'S064 Published Article', 'Test excerpt for s064',
  '{"schema_version":1,"type":"doc","content":[]}'::jsonb, 1,
  'published', now() - interval '1 hour',
  '99000001-0000-4000-8000-000000000002',
  '99000001-0000-4000-8000-000000000001',
  to_tsvector('english', 'S064 Published Article Test excerpt for s064')
) ON CONFLICT (id) DO NOTHING;

-- draft article (should NOT appear)
INSERT INTO public.articles (id, locale, slug, title, excerpt, body, body_version, status, published_at, author_id, category_id, search_vector)
VALUES (
  '99000001-0000-4000-8000-000000000004',
  'en', 's064-draft', 'S064 Draft Article', 'Draft excerpt',
  '{"schema_version":1,"type":"doc","content":[]}'::jsonb, 1,
  'draft', now() - interval '1 hour',
  '99000001-0000-4000-8000-000000000002',
  '99000001-0000-4000-8000-000000000001',
  to_tsvector('english', 'S064 Draft Article Draft excerpt')
) ON CONFLICT (id) DO NOTHING;

-- hidden article (should NOT appear)
INSERT INTO public.articles (id, locale, slug, title, excerpt, body, body_version, status, published_at, author_id, category_id, search_vector)
VALUES (
  '99000001-0000-4000-8000-000000000005',
  'en', 's064-hidden', 'S064 Hidden Article', 'Hidden excerpt',
  '{"schema_version":1,"type":"doc","content":[]}'::jsonb, 1,
  'hidden', now() - interval '1 hour',
  '99000001-0000-4000-8000-000000000002',
  '99000001-0000-4000-8000-000000000001',
  to_tsvector('english', 'S064 Hidden Article Hidden excerpt')
) ON CONFLICT (id) DO NOTHING;

-- scheduled (future published_at) article (should NOT appear)
INSERT INTO public.articles (id, locale, slug, title, excerpt, body, body_version, status, published_at, author_id, category_id, search_vector)
VALUES (
  '99000001-0000-4000-8000-000000000006',
  'en', 's064-scheduled', 'S064 Scheduled Article', 'Scheduled excerpt',
  '{"schema_version":1,"type":"doc","content":[]}'::jsonb, 1,
  'published', now() + interval '1 hour',
  '99000001-0000-4000-8000-000000000002',
  '99000001-0000-4000-8000-000000000001',
  to_tsvector('english', 'S064 Scheduled Article Scheduled excerpt')
) ON CONFLICT (id) DO NOTHING;

-- soft-deleted article (should NOT appear)
INSERT INTO public.articles (id, locale, slug, title, excerpt, body, body_version, status, published_at, deleted_at, author_id, category_id, search_vector)
VALUES (
  '99000001-0000-4000-8000-000000000007',
  'en', 's064-deleted', 'S064 Deleted Article', 'Deleted excerpt',
  '{"schema_version":1,"type":"doc","content":[]}'::jsonb, 1,
  'published', now() - interval '1 hour', now() - interval '30 minutes',
  '99000001-0000-4000-8000-000000000002',
  '99000001-0000-4000-8000-000000000001',
  to_tsvector('english', 'S064 Deleted Article Deleted excerpt')
) ON CONFLICT (id) DO NOTHING;

-- ── Document seed ────────────────────────────────────────────────────────────

INSERT INTO public.documents (id, slug, title, description, file_format, doc_kind, price_cents, status, published_at, category_id, search_vector)
VALUES (
  '99000003-0000-4000-8000-000000000001',
  's064-pub-doc', 'S064 Published Document', 'Published doc description',
  'pptx', 'checklist', 100,
  'published', now() - interval '1 hour',
  '99000001-0000-4000-8000-000000000001',
  to_tsvector('english', 'S064 Published Document Published doc description')
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.documents (id, slug, title, description, file_format, doc_kind, price_cents, status, published_at, category_id, search_vector)
VALUES (
  '99000003-0000-4000-8000-000000000002',
  's064-draft-doc', 'S064 Draft Document', 'Draft doc description',
  'pptx', 'checklist', 100,
  'draft', NULL,
  '99000001-0000-4000-8000-000000000001',
  to_tsvector('english', 'S064 Draft Document Draft doc description')
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.documents (id, slug, title, description, file_format, doc_kind, price_cents, status, published_at, deleted_at, category_id, search_vector)
VALUES (
  '99000003-0000-4000-8000-000000000003',
  's064-deleted-doc', 'S064 Deleted Document', 'Deleted doc description',
  'pptx', 'checklist', 100,
  'published', now() - interval '1 hour', now() - interval '30 minutes',
  '99000001-0000-4000-8000-000000000001',
  to_tsvector('english', 'S064 Deleted Document Deleted doc description')
) ON CONFLICT (id) DO NOTHING;

-- Article for ranking order test (higher rank signal: title match)
INSERT INTO public.articles (id, locale, slug, title, excerpt, body, body_version, status, published_at, author_id, category_id, search_vector)
VALUES (
  '99000004-0000-4000-8000-000000000001',
  'en', 's064-rank-high', 'S064 RankQuery Article', 'Some excerpt',
  '{"schema_version":1,"type":"doc","content":[]}'::jsonb, 1,
  'published', now() - interval '1 hour',
  '99000001-0000-4000-8000-000000000002',
  '99000001-0000-4000-8000-000000000001',
  to_tsvector('english', 'S064 RankQuery Article S064 RankQuery Article S064 RankQuery Article')
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.articles (id, locale, slug, title, excerpt, body, body_version, status, published_at, author_id, category_id, search_vector)
VALUES (
  '99000004-0000-4000-8000-000000000002',
  'en', 's064-rank-low', 'S064 Filler Article', 'Some S064 RankQuery mention',
  '{"schema_version":1,"type":"doc","content":[]}'::jsonb, 1,
  'published', now() - interval '1 hour',
  '99000001-0000-4000-8000-000000000002',
  '99000001-0000-4000-8000-000000000001',
  to_tsvector('english', 'S064 Filler Article Some S064 RankQuery mention')
) ON CONFLICT (id) DO NOTHING;

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

DO $$
DECLARE
  i int;
BEGIN
  FOR i IN 1..60 LOOP
    INSERT INTO public.articles (id, locale, slug, title, excerpt, body, body_version, status, published_at, author_id, category_id, search_vector)
    VALUES (
      ('99000002-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
      'en', 's064-cap-' || i, 'S064 CapTest Article ' || i, 'cap excerpt',
      '{"schema_version":1,"type":"doc","content":[]}'::jsonb, 1,
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

-- ── AC6: file_key absent from function signature ──────────────────────────────

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
  'AC1: scope=documents does not return articles'
);

SELECT is(
  (SELECT count(*)::int FROM public.search_all('S064 Published Article', 'articles', 50)),
  1,
  'AC1: scope=articles returns articles'
);

SELECT is(
  (SELECT count(*)::int FROM public.search_all('S064 Published Article', 'all', 50)
   WHERE kind = 'article'),
  1,
  'AC1: scope=all returns articles'
);

SELECT is(
  (SELECT count(*)::int FROM public.search_all('S064 Published Document', 'all', 50)
   WHERE kind = 'document'),
  1,
  'AC1: scope=all returns documents'
);

-- ── AC4: document visibility ─────────────────────────────────────────────────

SELECT is(
  (SELECT count(*)::int FROM public.search_all('S064 Published Document', 'documents', 50)
   WHERE kind = 'document'),
  1,
  'AC4: published document is returned'
);

SELECT is(
  (SELECT count(*)::int FROM public.search_all('S064 Draft Document', 'documents', 50)
   WHERE kind = 'document'),
  0,
  'AC4: draft document is not returned'
);

SELECT is(
  (SELECT count(*)::int FROM public.search_all('S064 Deleted Document', 'documents', 50)
   WHERE kind = 'document'),
  0,
  'AC4: soft-deleted document is not returned'
);

-- ── AC3: ranking order ────────────────────────────────────────────────────────
-- The article with 3× the query term in its search_vector should rank higher.

SELECT is(
  (SELECT kind || '/' || slug FROM public.search_all('S064 RankQuery', 'articles', 50) LIMIT 1),
  'article/s064-rank-high',
  'AC3: higher-weight article ranks first'
);

-- ── AC1: locale filter — multi-locale article not duplicated ─────────────────

INSERT INTO public.articles (id, locale, slug, title, excerpt, body, body_version, status, published_at, author_id, category_id, search_vector)
VALUES (
  '99000005-0000-4000-8000-000000000001',
  'si', 's064-multiloc', 'S064 MultiLocale Article', 'Sinhala excerpt',
  '{"schema_version":1,"type":"doc","content":[]}'::jsonb, 1,
  'published', now() - interval '1 hour',
  '99000001-0000-4000-8000-000000000002',
  '99000001-0000-4000-8000-000000000001',
  to_tsvector('english', 'S064 MultiLocale Article Sinhala excerpt')
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.articles (id, locale, slug, title, excerpt, body, body_version, status, published_at, author_id, category_id, search_vector)
VALUES (
  '99000005-0000-4000-8000-000000000002',
  'ta', 's064-multiloc-ta', 'S064 MultiLocale Article', 'Tamil excerpt',
  '{"schema_version":1,"type":"doc","content":[]}'::jsonb, 1,
  'published', now() - interval '1 hour',
  '99000001-0000-4000-8000-000000000002',
  '99000001-0000-4000-8000-000000000001',
  to_tsvector('english', 'S064 MultiLocale Article Tamil excerpt')
) ON CONFLICT (id) DO NOTHING;

SELECT is(
  (SELECT count(*)::int FROM public.search_all('S064 MultiLocale Article', 'articles', 50)
   WHERE kind = 'article'),
  0,
  'AC1: si/ta locale rows excluded; only en rows returned'
);

SELECT * FROM finish();

ROLLBACK;
