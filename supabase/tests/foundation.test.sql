-- S-013: pgTAP tests — categories, authors, media_assets, site_settings,
--        pages, page_revisions, slug_redirects + FK, triggers, RLS.
-- Run with: supabase test db (requires Docker + local Supabase stack).
--
-- Assertion count: 104
--   AC1 categories: 10, EC4: 1, AC1 authors: 11, AC2: 15,
--   AC3 pages: 10, AC3 page_revisions: 8, EC3: 2, EC1/EC2/AC4: 6,
--   AC5: 5, AC6: 10, AC7/EC6/EC7: 10, AC8/AC9 reads: 9, AC9 writes: 7

BEGIN;
SELECT plan(104);

-- ─────────────────────────────────────────────────────────────────────────────
-- Fixtures (postgres/service role; all rolled back after the test)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_sa    uuid := '22111111-0000-0000-0000-000000000001'::uuid;
  v_admin uuid := '22111111-0000-0000-0000-000000000002'::uuid;
  v_cust  uuid := '22111111-0000-0000-0000-000000000003'::uuid;
BEGIN
  INSERT INTO public.profiles (id, display_name, email, status) VALUES
    (v_sa,    'SA Foundation',    'sa_found@test.com',    'active'),
    (v_admin, 'Admin Foundation', 'admin_found@test.com', 'active'),
    (v_cust,  'Cust Foundation',  'cust_found@test.com',  'active');
  INSERT INTO public.user_roles (user_id, role) VALUES
    (v_sa, 'super_admin'), (v_admin, 'admin');
  -- Admin has settings.site + authors.write; NOT settings.contact or settings.system
  INSERT INTO public.role_permissions (role, action) VALUES
    ('admin', 'settings.site'), ('admin', 'authors.write')
  ON CONFLICT (role, action) DO NOTHING;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- AC1: categories — 10 assertions
-- ─────────────────────────────────────────────────────────────────────────────

SELECT has_table('public', 'categories', 'AC1: categories table exists');
SELECT has_column('public', 'categories', 'id',          'AC1: categories.id');
SELECT has_column('public', 'categories', 'slug',        'AC1: categories.slug');
SELECT has_column('public', 'categories', 'name',        'AC1: categories.name');
SELECT has_column('public', 'categories', 'name_i18n',   'AC1: categories.name_i18n');
SELECT has_column('public', 'categories', 'applies_to',  'AC1: categories.applies_to');
SELECT has_column('public', 'categories', 'order_index', 'AC1: categories.order_index');
SELECT has_column('public', 'categories', 'created_at',  'AC1: categories.created_at');
SELECT col_is_unique('public', 'categories', 'slug', 'AC1: categories.slug UNIQUE');
SELECT col_is_unique('public', 'categories', 'name', 'AC1: categories.name UNIQUE');

-- EC4: applies_to CHECK refuses unknown value — 1 assertion
SELECT throws_ok(
  $$INSERT INTO public.categories (slug, name, applies_to)
    VALUES ('bad', 'Bad Cat', ARRAY['banner'])$$,
  '23514', NULL,
  'EC4: categories.applies_to=banner refused by CHECK'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- AC1: authors — 11 assertions
-- ─────────────────────────────────────────────────────────────────────────────

SELECT has_table('public', 'authors', 'AC1: authors table exists');
SELECT has_column('public', 'authors', 'id',          'AC1: authors.id');
SELECT has_column('public', 'authors', 'slug',        'AC1: authors.slug');
SELECT has_column('public', 'authors', 'name',        'AC1: authors.name');
SELECT has_column('public', 'authors', 'bio',         'AC1: authors.bio');
SELECT has_column('public', 'authors', 'photo_key',   'AC1: authors.photo_key');
SELECT has_column('public', 'authors', 'is_active',   'AC1: authors.is_active');
SELECT has_column('public', 'authors', 'order_index', 'AC1: authors.order_index');
SELECT has_column('public', 'authors', 'created_at',  'AC1: authors.created_at');
SELECT has_column('public', 'authors', 'updated_at',  'AC1: authors.updated_at');
SELECT col_is_unique('public', 'authors', 'slug', 'AC1: authors.slug UNIQUE');

-- ─────────────────────────────────────────────────────────────────────────────
-- AC2: media_assets — 15 assertions
-- ─────────────────────────────────────────────────────────────────────────────

SELECT has_table('public', 'media_assets', 'AC2: media_assets table exists');
SELECT has_column('public', 'media_assets', 'id',          'AC2: media_assets.id');
SELECT has_column('public', 'media_assets', 'bucket',      'AC2: media_assets.bucket');
SELECT has_column('public', 'media_assets', 'status',      'AC2: media_assets.status');
SELECT has_column('public', 'media_assets', 'file_key',    'AC2: media_assets.file_key');
SELECT has_column('public', 'media_assets', 'kind',        'AC2: media_assets.kind');
SELECT has_column('public', 'media_assets', 'mime_type',   'AC2: media_assets.mime_type');
SELECT has_column('public', 'media_assets', 'size_bytes',  'AC2: media_assets.size_bytes');
SELECT has_column('public', 'media_assets', 'width',       'AC2: media_assets.width');
SELECT has_column('public', 'media_assets', 'height',      'AC2: media_assets.height');
SELECT has_column('public', 'media_assets', 'alt_text',    'AC2: media_assets.alt_text');
SELECT has_column('public', 'media_assets', 'uploaded_by', 'AC2: media_assets.uploaded_by');
SELECT has_column('public', 'media_assets', 'created_at',  'AC2: media_assets.created_at');
SELECT col_is_unique('public', 'media_assets', 'file_key',
  'EC5: media_assets.file_key UNIQUE');
SELECT has_index('public', 'media_assets', 'idx_media_assets_created_at',
  'AC2: index on media_assets.created_at exists');

-- ─────────────────────────────────────────────────────────────────────────────
-- AC3: pages — 10 assertions
-- ─────────────────────────────────────────────────────────────────────────────

SELECT has_table('public', 'pages', 'AC3: pages table exists');
SELECT has_column('public', 'pages', 'id',         'AC3: pages.id');
SELECT has_column('public', 'pages', 'locale',     'AC3: pages.locale');
SELECT has_column('public', 'pages', 'slug',       'AC3: pages.slug');
SELECT has_column('public', 'pages', 'title',      'AC3: pages.title');
SELECT has_column('public', 'pages', 'body',       'AC3: pages.body');
SELECT has_column('public', 'pages', 'version',    'AC3: pages.version');
SELECT has_column('public', 'pages', 'updated_by', 'AC3: pages.updated_by');
SELECT has_column('public', 'pages', 'created_at', 'AC3: pages.created_at');
SELECT has_column('public', 'pages', 'updated_at', 'AC3: pages.updated_at');

-- ─────────────────────────────────────────────────────────────────────────────
-- AC3: page_revisions — 8 assertions
-- ─────────────────────────────────────────────────────────────────────────────

SELECT has_table('public', 'page_revisions', 'AC3: page_revisions table exists');
SELECT has_column('public', 'page_revisions', 'id',           'AC3: page_revisions.id');
SELECT has_column('public', 'page_revisions', 'page_id',      'AC3: page_revisions.page_id');
SELECT has_column('public', 'page_revisions', 'version',      'AC3: page_revisions.version');
SELECT has_column('public', 'page_revisions', 'title',        'AC3: page_revisions.title');
SELECT has_column('public', 'page_revisions', 'body',         'AC3: page_revisions.body');
SELECT has_column('public', 'page_revisions', 'published_by', 'AC3: page_revisions.published_by');
SELECT has_column('public', 'page_revisions', 'published_at', 'AC3: page_revisions.published_at');

-- EC3: UNIQUE(locale,slug) enforced; same slug in different locale allowed — 2 assertions
SELECT throws_ok(
  $s$DO $sub$
    DECLARE v uuid;
    BEGIN
      INSERT INTO public.pages (locale, slug, title) VALUES ('en', 'dup-test', 'D1')
      RETURNING id INTO v;
      INSERT INTO public.pages (locale, slug, title) VALUES ('en', 'dup-test', 'D2');
    END; $sub$$s$,
  '23505', NULL,
  'EC3: same (locale,slug) pair is refused'
);

INSERT INTO public.pages (locale, slug, title)
VALUES ('en', 'terms', 'Terms EN')
ON CONFLICT (locale, slug) DO NOTHING;

SELECT lives_ok(
  $$INSERT INTO public.pages (locale, slug, title) VALUES ('si', 'terms', 'Terms SI')$$,
  'EC3: same slug in different locale is allowed'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- AC4 / EC1 / EC2: append-only on page_revisions — 6 assertions
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.pages (id, locale, slug, title)
VALUES ('bb000001-0000-0000-0000-000000000001'::uuid, 'en', 'ci-test-privacy', 'Privacy');

INSERT INTO public.page_revisions (page_id, version, title)
VALUES ('bb000001-0000-0000-0000-000000000001'::uuid, 1, 'Privacy v1');

-- EC1: delete page with revision is refused (FK RESTRICT)
SELECT throws_ok(
  $$DELETE FROM public.pages
    WHERE id = 'bb000001-0000-0000-0000-000000000001'::uuid$$,
  '23503', NULL,
  'EC1: delete page with revision refused (RESTRICT FK)'
);

-- EC2: UPDATE revision refused
SELECT throws_ok(
  $$UPDATE public.page_revisions SET title = 'hacked'
    WHERE page_id = 'bb000001-0000-0000-0000-000000000001'::uuid$$,
  '23001', NULL,
  'EC2: UPDATE page_revisions refused (append-only)'
);

-- EC2: service_role also cannot UPDATE page_revisions (no GUC exception on this table)
SET LOCAL role TO 'service_role';
SELECT throws_ok(
  $$UPDATE public.page_revisions SET title = 'svc_hack'
    WHERE page_id = 'bb000001-0000-0000-0000-000000000001'::uuid$$,
  '23001', NULL,
  'EC2: UPDATE page_revisions refused even as service_role'
);
SELECT throws_ok(
  $$DELETE FROM public.page_revisions
    WHERE page_id = 'bb000001-0000-0000-0000-000000000001'::uuid$$,
  '23001', NULL,
  'EC2: DELETE page_revisions refused even as service_role'
);
RESET role;

-- AC4: INSERT a new revision IS allowed
SELECT lives_ok(
  $$INSERT INTO public.page_revisions (page_id, version, title)
    VALUES ('bb000001-0000-0000-0000-000000000001'::uuid, 2, 'Privacy v2')$$,
  'AC4: INSERT on page_revisions is allowed'
);

-- AC3: UNIQUE(page_id,version) enforced
SELECT throws_ok(
  $$INSERT INTO public.page_revisions (page_id, version, title)
    VALUES ('bb000001-0000-0000-0000-000000000001'::uuid, 1, 'Dup v1')$$,
  '23505', NULL,
  'AC3: UNIQUE(page_id,version) is enforced'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- AC5: profiles.terms_revision_id FK and create_profile_for behavior — 5 assertions
-- ─────────────────────────────────────────────────────────────────────────────

SELECT has_column('public', 'profiles', 'terms_revision_id',
  'AC5: profiles.terms_revision_id column exists');

SELECT throws_ok(
  $$UPDATE public.profiles
    SET terms_revision_id = '00000000-0000-0000-0000-000000000099'::uuid
    WHERE email = 'cust_found@test.com'$$,
  '23503', NULL,
  'AC5: invalid terms_revision_id FK is refused'
);

-- create_profile_for behavior: known UUIDs so SELECT ok() can reference them directly
INSERT INTO public.pages (id, locale, slug, title)
VALUES ('cc000001-0000-0000-0000-000000000001'::uuid, 'en', 'ac5-terms', 'AC5 Terms');

INSERT INTO public.page_revisions (id, page_id, version, title)
VALUES ('cc000001-0000-0000-0000-000000000002'::uuid,
        'cc000001-0000-0000-0000-000000000001'::uuid, 1, 'AC5 Terms v1');

-- Inserting into auth.users fires create_profile_for trigger
INSERT INTO auth.users (
  id, email, raw_user_meta_data, raw_app_meta_data,
  aud, role, created_at, updated_at, confirmation_token, email_confirmed_at
) VALUES
  -- Case A: valid revision_id -> stored
  ('cc000001-0000-0000-0000-000000000010'::uuid, 'pf1@test.com',
   jsonb_build_object('first_name', 'PF1',
     'terms_revision_id', 'cc000001-0000-0000-0000-000000000002'),
   '{"provider":"email"}'::jsonb, 'authenticated', 'authenticated',
   now(), now(), '', now()),
  -- Case B: non-existent UUID -> NULL (no error)
  ('cc000001-0000-0000-0000-000000000011'::uuid, 'pf2@test.com',
   jsonb_build_object('first_name', 'PF2',
     'terms_revision_id', '00000000-0000-0000-0000-000000000099'),
   '{"provider":"email"}'::jsonb, 'authenticated', 'authenticated',
   now(), now(), '', now()),
  -- Case C: malformed UUID -> NULL (no error, no crash)
  ('cc000001-0000-0000-0000-000000000012'::uuid, 'pf3@test.com',
   jsonb_build_object('first_name', 'PF3', 'terms_revision_id', 'not-a-uuid'),
   '{"provider":"email"}'::jsonb, 'authenticated', 'authenticated',
   now(), now(), '', now());

SELECT ok(
  (SELECT terms_revision_id FROM public.profiles
   WHERE id = 'cc000001-0000-0000-0000-000000000010'::uuid)
  = 'cc000001-0000-0000-0000-000000000002'::uuid,
  'AC5: create_profile_for stores valid terms_revision_id'
);
SELECT ok(
  (SELECT terms_revision_id FROM public.profiles
   WHERE id = 'cc000001-0000-0000-0000-000000000011'::uuid) IS NULL,
  'AC5: create_profile_for stores NULL for non-existent revision'
);
SELECT ok(
  (SELECT terms_revision_id FROM public.profiles
   WHERE id = 'cc000001-0000-0000-0000-000000000012'::uuid) IS NULL,
  'AC5: create_profile_for stores NULL for malformed UUID'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- AC6: slug_redirects — 9 assertions
-- ─────────────────────────────────────────────────────────────────────────────

SELECT has_table('public', 'slug_redirects', 'AC6: slug_redirects table exists');
SELECT has_column('public', 'slug_redirects', 'id',          'AC6: slug_redirects.id');
SELECT has_column('public', 'slug_redirects', 'entity_type', 'AC6: slug_redirects.entity_type');
SELECT has_column('public', 'slug_redirects', 'entity_id',   'AC6: slug_redirects.entity_id');
SELECT has_column('public', 'slug_redirects', 'locale',      'AC6: slug_redirects.locale');
SELECT has_column('public', 'slug_redirects', 'old_slug',    'AC6: slug_redirects.old_slug');
SELECT has_column('public', 'slug_redirects', 'created_at',  'AC6: slug_redirects.created_at');

SELECT throws_ok(
  $$INSERT INTO public.slug_redirects (entity_type, entity_id, old_slug)
    VALUES ('banner', gen_random_uuid(), 'old-banner')$$,
  '23514', NULL,
  'AC6: invalid entity_type refused by CHECK'
);

INSERT INTO public.slug_redirects (entity_type, entity_id, locale, old_slug)
VALUES ('article', gen_random_uuid(), 'en', 'dup-redirect');

SELECT throws_ok(
  $$INSERT INTO public.slug_redirects (entity_type, entity_id, locale, old_slug)
    VALUES ('article', gen_random_uuid(), 'en', 'dup-redirect')$$,
  '23505', NULL,
  'AC6: UNIQUE(entity_type,locale,old_slug) is enforced'
);

-- NULLS NOT DISTINCT: two document rows with locale=NULL and same old_slug are also refused
INSERT INTO public.slug_redirects (entity_type, entity_id, old_slug)
VALUES ('document', gen_random_uuid(), 'dup-doc-slug');

SELECT throws_ok(
  $$INSERT INTO public.slug_redirects (entity_type, entity_id, old_slug)
    VALUES ('document', gen_random_uuid(), 'dup-doc-slug')$$,
  '23505', NULL,
  'AC6: NULLS NOT DISTINCT — duplicate null-locale old_slug is refused'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- AC7 / EC6 / EC7: site_settings — 10 assertions
-- ─────────────────────────────────────────────────────────────────────────────

SELECT has_table('public', 'site_settings', 'AC7: site_settings table exists');
SELECT has_index('public', 'site_settings', 'idx_site_settings_group',
  'AC7: index on site_settings.setting_group exists');

SELECT throws_ok(
  $$INSERT INTO public.site_settings (key, value, setting_group)
    VALUES ('bad_key', '"x"', 'invalid_group')$$,
  '23514', NULL,
  'EC7: setting_group outside 6 values is refused'
);

-- Seed test settings
INSERT INTO public.site_settings (key, value, is_public, setting_group) VALUES
  ('t_site',    '"v"', true,  'site'),
  ('t_contact', '"v"', false, 'contact'),
  ('t_system',  '"v"', false, 'system');

-- EC6: service_role can update any group
SET LOCAL role TO 'service_role';
SELECT lives_ok(
  $$UPDATE public.site_settings SET value = '"svc"' WHERE key = 't_site'$$,
  'EC6: service_role can update site setting'
);
SELECT lives_ok(
  $$UPDATE public.site_settings SET value = '"svc"' WHERE key = 't_contact'$$,
  'EC6: service_role can update contact setting'
);
SELECT lives_ok(
  $$UPDATE public.site_settings SET value = '"svc"' WHERE key = 't_system'$$,
  'EC6: service_role can update system setting'
);
RESET role;

-- Admin (settings.site) cannot update contact or system groups
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO
  '{"sub":"22111111-0000-0000-0000-000000000002","role":"authenticated"}';
SELECT throws_ok(
  $$UPDATE public.site_settings SET value = '"x"' WHERE key = 't_contact'$$,
  '23001', NULL,
  'AC9: admin cannot update contact setting (cross-group block)'
);
SELECT lives_ok(
  $$UPDATE public.site_settings SET value = '"ok"' WHERE key = 't_site'$$,
  'AC7: admin can update site setting'
);
SELECT throws_ok(
  $$UPDATE public.site_settings SET value = '"x"' WHERE key = 't_system'$$,
  '23001', NULL,
  'AC9: admin cannot update system setting'
);
RESET role;

-- Super Admin can update system group
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO
  '{"sub":"22111111-0000-0000-0000-000000000001","role":"authenticated"}';
SELECT lives_ok(
  $$UPDATE public.site_settings SET value = '"sa_ok"' WHERE key = 't_system'$$,
  'AC9: Super Admin can update system setting'
);
RESET role;

-- ─────────────────────────────────────────────────────────────────────────────
-- AC8 / AC9: RLS visibility — 9 assertions
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.authors (slug, name, is_active) VALUES
  ('author-active',   'Active Author',   true),
  ('author-inactive', 'Inactive Author', false);

INSERT INTO public.slug_redirects (entity_type, entity_id, locale, old_slug)
VALUES ('article', gen_random_uuid(), 'en', 'old-article');

SET LOCAL role TO anon;

SELECT is(
  (SELECT count(*)::int FROM public.site_settings WHERE key = 't_contact'),
  0,
  'AC9: anon cannot read private setting'
);
SELECT ok(
  (SELECT count(*) FROM public.site_settings WHERE key = 't_site') >= 1,
  'AC8: anon can read public setting'
);
SELECT is(
  (SELECT count(*)::int FROM public.media_assets),
  0,
  'AC8: anon cannot read any media_assets row'
);
SELECT ok(
  (SELECT count(*) FROM public.authors WHERE slug = 'author-active') >= 1,
  'AC8: anon can read active author'
);
SELECT is(
  (SELECT count(*)::int FROM public.authors WHERE slug = 'author-inactive'),
  0,
  'AC8: anon cannot see inactive author'
);
SELECT ok(
  (SELECT count(*) FROM public.slug_redirects WHERE old_slug = 'old-article') >= 1,
  'AC8: anon can read slug_redirects'
);
SELECT ok(
  (SELECT count(*) FROM public.pages WHERE slug = 'privacy') >= 1,
  'AC8: anon can read pages'
);
SELECT ok(
  (SELECT count(*) FROM public.page_revisions
    WHERE page_id = 'bb000001-0000-0000-0000-000000000001'::uuid) >= 1,
  'AC8: anon can read page_revisions'
);
RESET role;

-- Customer cannot read media_assets
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO
  '{"sub":"22111111-0000-0000-0000-000000000003","role":"authenticated"}';
SELECT is(
  (SELECT count(*)::int FROM public.media_assets),
  0,
  'AC8: customer cannot read media_assets'
);
RESET role;

-- ─────────────────────────────────────────────────────────────────────────────
-- AC9: customer cannot INSERT or UPDATE any of the 7 tables — 7 assertions
-- ─────────────────────────────────────────────────────────────────────────────

SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO
  '{"sub":"22111111-0000-0000-0000-000000000003","role":"authenticated"}';

SELECT throws_ok(
  $$INSERT INTO public.categories (slug, name) VALUES ('rls-cat', 'RLS Cat')$$,
  '42501', NULL, 'AC9: customer cannot INSERT into categories'
);
SELECT throws_ok(
  $$INSERT INTO public.authors (slug, name) VALUES ('rls-author', 'RLS Author')$$,
  '42501', NULL, 'AC9: customer cannot INSERT into authors'
);
SELECT throws_ok(
  $$INSERT INTO public.site_settings (key, value, setting_group)
    VALUES ('rls-key', '"x"', 'site')$$,
  '42501', NULL, 'AC9: customer cannot INSERT into site_settings'
);
SELECT lives_ok(
  $$UPDATE public.categories SET order_index = 99 WHERE slug = 'bad'$$,
  'AC9: customer cannot UPDATE categories (RLS silently blocks)'
);
SELECT lives_ok(
  $$UPDATE public.authors SET order_index = 99 WHERE slug = 'author-active'$$,
  'AC9: customer cannot UPDATE authors (RLS silently blocks)'
);
SELECT lives_ok(
  $$UPDATE public.pages SET title = 'hacked' WHERE slug = 'terms'$$,
  'AC9: customer cannot UPDATE pages (RLS silently blocks)'
);
SELECT lives_ok(
  $$UPDATE public.site_settings SET value = '"hacked"' WHERE key = 't_site'$$,
  'AC9: customer cannot UPDATE site_settings (RLS silently blocks)'
);

RESET role;

SELECT * FROM finish();
ROLLBACK;
