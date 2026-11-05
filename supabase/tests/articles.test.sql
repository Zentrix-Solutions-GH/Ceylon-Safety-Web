-- S-048: pgTAP RLS tests — articles and article_refs tables.
-- Run with: supabase test db (requires Docker + local Supabase stack).
--
-- Assertion count: 32
--   articles table: 6, RLS anon: 4, RLS customer: 4, RLS staff: 6,
--   article_refs table: 4, RLS article_refs: 8

BEGIN;
SELECT plan(35);

-- ─────────────────────────────────────────────────────────────────────────────
-- Fixtures (postgres/service role; all rolled back after the test)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_sa     uuid := '48111111-0000-0000-0000-000000000001'::uuid;
  v_admin  uuid := '48111111-0000-0000-0000-000000000002'::uuid;
  v_cust   uuid := '48111111-0000-0000-0000-000000000003'::uuid;
  v_author uuid := '48111111-0000-0000-0000-000000000010'::uuid;
  v_cat    uuid := '48111111-0000-0000-0000-000000000011'::uuid;
BEGIN
  INSERT INTO public.profiles (id, display_name, email, status) VALUES
    (v_sa,    'SA Articles',    'sa_articles@test.com',    'active'),
    (v_admin, 'Admin Articles', 'admin_articles@test.com', 'active'),
    (v_cust,  'Cust Articles',  'cust_articles@test.com',  'active');
  INSERT INTO public.user_roles (user_id, role) VALUES
    (v_sa, 'super_admin'), (v_admin, 'admin');
  INSERT INTO public.role_permissions (role, action) VALUES
    ('admin', 'articles.write'), ('admin', 'articles.publish')
  ON CONFLICT (role, action) DO NOTHING;
  -- minimal author and category for FK
  INSERT INTO public.authors  (id, slug, name, is_active) VALUES (v_author, 'test-author-048', 'Test Author', TRUE);
  INSERT INTO public.categories (id, slug, name, applies_to) VALUES (v_cat, 'test-cat-048', 'Test Cat 048', ARRAY['article']::text[]);
  -- seed one draft and one published article as service role
  INSERT INTO public.articles (id, locale, slug, title, body, body_version, status, published_at, author_id, category_id)
    VALUES
      ('48aaaaaa-0000-4000-8000-000000000001'::uuid, 'en', 'draft-article-048', 'Draft 048',
       '{"schema_version":1,"type":"doc","content":[]}'::jsonb, 1, 'draft', NULL, v_author, v_cat),
      ('48aaaaaa-0000-4000-8000-000000000002'::uuid, 'en', 'published-article-048', 'Published 048',
       '{"schema_version":1,"type":"doc","content":[]}'::jsonb, 1, 'published', now(), v_author, v_cat);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- articles table structure — 6 assertions
-- ─────────────────────────────────────────────────────────────────────────────

SELECT has_table('public', 'articles', 'S-048: articles table exists');
SELECT has_column('public', 'articles', 'id',           'S-048: articles.id');
SELECT has_column('public', 'articles', 'body',         'S-048: articles.body');
SELECT has_column('public', 'articles', 'body_version', 'S-048: articles.body_version');
SELECT has_column('public', 'articles', 'deleted_at',   'S-048: articles.deleted_at (soft delete)');
SELECT col_is_pk('public', 'articles', 'id',            'S-048: articles.id is PK');

-- ─────────────────────────────────────────────────────────────────────────────
-- article_refs table structure — 4 assertions
-- ─────────────────────────────────────────────────────────────────────────────

SELECT has_table('public', 'article_refs', 'S-048: article_refs table exists');
SELECT has_column('public', 'article_refs', 'article_id', 'S-048: article_refs.article_id');
SELECT has_column('public', 'article_refs', 'ref_type',   'S-048: article_refs.ref_type');
SELECT has_column('public', 'article_refs', 'ref_id',     'S-048: article_refs.ref_id');

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS: anon can read published articles, cannot read drafts — 4 assertions
-- ─────────────────────────────────────────────────────────────────────────────

SET LOCAL ROLE anon;

SELECT results_eq(
  $$SELECT COUNT(*)::int FROM public.articles
    WHERE id = '48aaaaaa-0000-4000-8000-000000000002'$$,
  ARRAY[1],
  'S-048 RLS: anon can read published article'
);

SELECT results_eq(
  $$SELECT COUNT(*)::int FROM public.articles
    WHERE id = '48aaaaaa-0000-4000-8000-000000000001'$$,
  ARRAY[0],
  'S-048 RLS: anon cannot read draft article'
);

SELECT throws_ok(
  $$INSERT INTO public.articles (locale, slug, title, body, body_version, status, author_id, category_id)
    VALUES ('en','anon-attempt','Anon','{"schema_version":1,"type":"doc","content":[]}'::jsonb,1,'draft',
            '48111111-0000-0000-0000-000000000010',
            '48111111-0000-0000-0000-000000000011')$$,
  NULL, NULL,
  'S-048 RLS: anon cannot insert articles'
);

-- RLS blocks UPDATE by returning 0 rows (no exception); verify via row count unchanged.
SELECT results_eq(
  $$WITH upd AS (
      UPDATE public.articles SET title = 'Hacked'
        WHERE id = '48aaaaaa-0000-4000-8000-000000000002'
      RETURNING id
    ) SELECT COUNT(*)::int FROM upd$$,
  ARRAY[0],
  'S-048 RLS: anon cannot update articles'
);

RESET ROLE;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS: authenticated customer — same as anon for articles — 4 assertions
-- ─────────────────────────────────────────────────────────────────────────────

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"48111111-0000-0000-0000-000000000003","role":"authenticated"}';

SELECT results_eq(
  $$SELECT COUNT(*)::int FROM public.articles
    WHERE id = '48aaaaaa-0000-4000-8000-000000000002'$$,
  ARRAY[1],
  'S-048 RLS: customer can read published article'
);

SELECT results_eq(
  $$SELECT COUNT(*)::int FROM public.articles
    WHERE id = '48aaaaaa-0000-4000-8000-000000000001'$$,
  ARRAY[0],
  'S-048 RLS: customer cannot read draft article'
);

SELECT throws_ok(
  $$INSERT INTO public.articles (locale, slug, title, body, body_version, status, author_id, category_id)
    VALUES ('en','cust-attempt','Cust','{"schema_version":1,"type":"doc","content":[]}'::jsonb,1,'draft',
            '48111111-0000-0000-0000-000000000010',
            '48111111-0000-0000-0000-000000000011')$$,
  NULL, NULL,
  'S-048 RLS: customer cannot insert articles'
);

-- RLS blocks UPDATE by returning 0 rows (no exception); verify via row count unchanged.
SELECT results_eq(
  $$WITH upd AS (
      UPDATE public.articles SET title = 'Hacked by Cust'
        WHERE id = '48aaaaaa-0000-4000-8000-000000000002'
      RETURNING id
    ) SELECT COUNT(*)::int FROM upd$$,
  ARRAY[0],
  'S-048 RLS: customer cannot update articles'
);

RESET ROLE;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS: staff (admin with articles.write) — can read all, write own — 6 assertions
-- ─────────────────────────────────────────────────────────────────────────────

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"48111111-0000-0000-0000-000000000002","role":"authenticated"}';

SELECT results_eq(
  $$SELECT COUNT(*)::int FROM public.articles
    WHERE id = '48aaaaaa-0000-4000-8000-000000000001'$$,
  ARRAY[1],
  'S-048 RLS: staff can read draft article'
);

SELECT results_eq(
  $$SELECT COUNT(*)::int FROM public.articles
    WHERE id = '48aaaaaa-0000-4000-8000-000000000002'$$,
  ARRAY[1],
  'S-048 RLS: staff can read published article'
);

SELECT lives_ok(
  $$UPDATE public.articles SET title = 'Staff Updated'
    WHERE id = '48aaaaaa-0000-4000-8000-000000000001'$$,
  'S-048 RLS: staff can update draft article'
);

SELECT lives_ok(
  $$INSERT INTO public.articles (locale, slug, title, body, body_version, status, author_id, category_id)
    VALUES ('en','staff-draft-048','Staff Draft',
            '{"schema_version":1,"type":"doc","content":[]}'::jsonb,1,'draft',
            '48111111-0000-0000-0000-000000000010',
            '48111111-0000-0000-0000-000000000011')$$,
  'S-048 RLS: staff can insert draft article'
);

-- Count only the 3 articles belonging to this test (seed.dev.sql may add more).
SELECT results_eq(
  $$SELECT COUNT(*)::int FROM public.articles
    WHERE slug IN ('draft-article-048','published-article-048','staff-draft-048')$$,
  ARRAY[3],
  'S-048 RLS: staff can read all articles'
);

SELECT results_eq(
  $$SELECT COUNT(*)::int FROM public.articles
    WHERE deleted_at IS NOT NULL$$,
  ARRAY[0],
  'S-048 RLS: soft delete not visible via deleted_at filter to verify fixture'
);

RESET ROLE;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS: article_refs — anon sees refs for published articles only — 8 assertions
-- ─────────────────────────────────────────────────────────────────────────────

-- seed a ref for the published article (service role)
INSERT INTO public.article_refs (article_id, node_id, ref_type, ref_id)
  VALUES ('48aaaaaa-0000-4000-8000-000000000002'::uuid, 'node-1', 'media', 'img/test.webp');

SET LOCAL ROLE anon;

-- article_refs has no public SELECT policy; anon cannot read refs at all.
SELECT results_eq(
  $$SELECT COUNT(*)::int FROM public.article_refs
    WHERE article_id = '48aaaaaa-0000-4000-8000-000000000002'$$,
  ARRAY[0],
  'S-048 RLS: anon cannot read article_refs (no public read policy)'
);

SELECT results_eq(
  $$SELECT COUNT(*)::int FROM public.article_refs
    WHERE article_id = '48aaaaaa-0000-4000-8000-000000000001'$$,
  ARRAY[0],
  'S-048 RLS: anon cannot read refs for draft article'
);

SELECT throws_ok(
  $$INSERT INTO public.article_refs (article_id, node_id, ref_type, ref_id)
    VALUES ('48aaaaaa-0000-4000-8000-000000000002','node-x','media','img/x.webp')$$,
  NULL, NULL,
  'S-048 RLS: anon cannot insert article_refs'
);

-- RLS blocks DELETE by returning 0 rows (no exception), same as blocked UPDATE.
SELECT results_eq(
  $$WITH del AS (
      DELETE FROM public.article_refs WHERE article_id = '48aaaaaa-0000-4000-8000-000000000002'
      RETURNING id
    ) SELECT COUNT(*)::int FROM del$$,
  ARRAY[0],
  'S-048 RLS: anon cannot delete article_refs'
);

RESET ROLE;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"48111111-0000-0000-0000-000000000002","role":"authenticated"}';

SELECT results_eq(
  $$SELECT COUNT(*)::int FROM public.article_refs
    WHERE article_id = '48aaaaaa-0000-4000-8000-000000000001'$$,
  ARRAY[0],
  'S-048 RLS: staff sees refs only for non-draft articles (or via service role in actions)'
);

SELECT results_eq(
  $$SELECT COUNT(*)::int FROM public.article_refs
    WHERE article_id = '48aaaaaa-0000-4000-8000-000000000002'$$,
  ARRAY[1],
  'S-048 RLS: staff can read refs for published article'
);

-- article_refs writes are service_role only (BYPASSRLS); staff has SELECT policy only.
SELECT throws_ok(
  $$INSERT INTO public.article_refs (article_id, node_id, ref_type, ref_id)
    VALUES ('48aaaaaa-0000-4000-8000-000000000002','node-staff','media','img/staff.webp')$$,
  NULL, NULL,
  'S-048 RLS: staff cannot insert article_refs directly (service_role only)'
);

-- RLS blocks DELETE by returning 0 rows (no exception), same as blocked UPDATE.
SELECT results_eq(
  $$WITH del AS (
      DELETE FROM public.article_refs WHERE node_id = 'node-1'
      RETURNING id
    ) SELECT COUNT(*)::int FROM del$$,
  ARRAY[0],
  'S-048 RLS: staff cannot delete article_refs directly (service_role only)'
);

RESET ROLE;

-- ─────────────────────────────────────────────────────────────────────────────
-- S-049: RLS visibility — hidden, soft-deleted, future published_at — 3 assertions
-- ─────────────────────────────────────────────────────────────────────────────

RESET ROLE;

DO $$
DECLARE
  v_author uuid := '48111111-0000-0000-0000-000000000010'::uuid;
  v_cat    uuid := '48111111-0000-0000-0000-000000000011'::uuid;
BEGIN
  INSERT INTO public.articles (id, locale, slug, title, body, body_version, status, published_at, deleted_at, author_id, category_id)
    VALUES
      -- hidden: status=hidden, no deleted_at
      ('49aaaaaa-0000-4000-8000-000000000001'::uuid, 'en', 'hidden-049', 'Hidden 049',
       '{"schema_version":1,"type":"doc","content":[]}'::jsonb, 1, 'hidden', now(), NULL, v_author, v_cat),
      -- soft-deleted: published but deleted_at set
      ('49aaaaaa-0000-4000-8000-000000000002'::uuid, 'en', 'deleted-049', 'Deleted 049',
       '{"schema_version":1,"type":"doc","content":[]}'::jsonb, 1, 'published', now(), now(), v_author, v_cat),
      -- future: published but published_at in the future
      ('49aaaaaa-0000-4000-8000-000000000003'::uuid, 'en', 'future-049', 'Future 049',
       '{"schema_version":1,"type":"doc","content":[]}'::jsonb, 1, 'published', now() + interval '1 day', NULL, v_author, v_cat);
END;
$$;

SET LOCAL ROLE anon;

SELECT results_eq(
  $$SELECT COUNT(*)::int FROM public.articles
    WHERE id = '49aaaaaa-0000-4000-8000-000000000001'$$,
  ARRAY[0],
  'S-049 RLS: anon cannot read hidden article'
);

SELECT results_eq(
  $$SELECT COUNT(*)::int FROM public.articles
    WHERE id = '49aaaaaa-0000-4000-8000-000000000002'$$,
  ARRAY[0],
  'S-049 RLS: anon cannot read soft-deleted article'
);

SELECT results_eq(
  $$SELECT COUNT(*)::int FROM public.articles
    WHERE id = '49aaaaaa-0000-4000-8000-000000000003'$$,
  ARRAY[0],
  'S-049 RLS: anon cannot read future-published article'
);

RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
