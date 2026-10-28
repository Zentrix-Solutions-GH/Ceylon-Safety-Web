-- S-013: pgTAP tests — categories, authors, media_assets, site_settings,
--        pages, page_revisions, slug_redirects + FK, triggers, RLS.
-- Run with: supabase test db
-- Requires Docker + local Supabase stack.

BEGIN;
SELECT plan(110);

-- ─────────────────────────────────────────────────────────────────────────────
-- Fixtures (service role context; all rolled back after the test)
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
    (v_sa,    'super_admin'),
    (v_admin, 'admin');

  -- Admin has settings.site permission but NOT settings.contact
  INSERT INTO public.role_permissions (role, action) VALUES
    ('admin', 'settings.site'),
    ('admin', 'authors.write');
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- AC1: categories table — columns and constraints
-- ─────────────────────────────────────────────────────────────────────────────

SELECT has_table('public', 'categories', 'AC1: categories table exists');

SELECT has_column('public', 'categories', 'id',          'AC1: categories.id');
SELECT has_column('public', 'categories', 'slug',        'AC1: categories.slug');
SELECT has_column('public', 'categories', 'name',        'AC1: categories.name');
SELECT has_column('public', 'categories', 'name_i18n',   'AC1: categories.name_i18n');
SELECT has_column('public', 'categories', 'applies_to',  'AC1: categories.applies_to');
SELECT has_column('public', 'categories', 'order_index', 'AC1: categories.order_index');
SELECT has_column('public', 'categories', 'created_at',  'AC1: categories.created_at');

SELECT col_is_unique('public', 'categories', 'slug', 'AC1: categories.slug is UNIQUE');
SELECT col_is_unique('public', 'categories', 'name', 'AC1: categories.name is UNIQUE');

-- EC4: applies_to with invalid value is refused
SELECT throws_ok(
  $$INSERT INTO public.categories (slug, name, applies_to)
    VALUES ('ws', 'Workplace Safety', ARRAY['banner'])$$,
  'EC4: categories.applies_to = banner is refused'
);

-- AC1: authors table — columns and constraints
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

SELECT col_is_unique('public', 'authors', 'slug', 'AC1: authors.slug is UNIQUE');

-- ─────────────────────────────────────────────────────────────────────────────
-- AC2: media_assets table — columns, CHECKs, index
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

-- EC5: file_key UNIQUE
SELECT col_is_unique('public', 'media_assets', 'file_key', 'EC5: media_assets.file_key is UNIQUE');

-- Index on created_at
SELECT has_index('public', 'media_assets', 'idx_media_assets_created_at',
  'AC2: index on media_assets.created_at exists');

-- ─────────────────────────────────────────────────────────────────────────────
-- AC3: pages and page_revisions — columns and UNIQUE constraints
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

SELECT has_table('public', 'page_revisions', 'AC3: page_revisions table exists');
SELECT has_column('public', 'page_revisions', 'id',           'AC3: page_revisions.id');
SELECT has_column('public', 'page_revisions', 'page_id',      'AC3: page_revisions.page_id');
SELECT has_column('public', 'page_revisions', 'version',      'AC3: page_revisions.version');
SELECT has_column('public', 'page_revisions', 'title',        'AC3: page_revisions.title');
SELECT has_column('public', 'page_revisions', 'body',         'AC3: page_revisions.body');
SELECT has_column('public', 'page_revisions', 'published_by', 'AC3: page_revisions.published_by');
SELECT has_column('public', 'page_revisions', 'published_at', 'AC3: page_revisions.published_at');

-- EC3: same (locale, slug) refused
SELECT throws_ok(
  $$DO $sub$
  DECLARE v_p1 uuid;
  BEGIN
    INSERT INTO public.pages (locale, slug, title) VALUES ('en', 'terms', 'Terms')
    RETURNING id INTO v_p1;
    INSERT INTO public.pages (locale, slug, title) VALUES ('en', 'terms', 'Terms2');
  END;
  $sub$$$,
  'EC3: same locale+slug is refused'
);

-- EC3 (positive): same slug in different locale is allowed
SELECT lives_ok(
  $$INSERT INTO public.pages (locale, slug, title) VALUES ('si', 'terms', 'Terms SI')$$,
  'EC3: same slug in si is allowed'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- AC4 / EC1 / EC2: append-only on page_revisions
-- ─────────────────────────────────────────────────────────────────────────────

-- Setup: one page with two revisions
DO $$
DECLARE v_page uuid;
BEGIN
  INSERT INTO public.pages (locale, slug, title) VALUES ('en', 'privacy', 'Privacy')
  RETURNING id INTO v_page;

  INSERT INTO public.page_revisions (page_id, version, title)
  VALUES (v_page, 1, 'Privacy v1');
END;
$$;

-- EC1: delete a page that has a revision is refused (RESTRICT FK)
SELECT throws_ok(
  $$DELETE FROM public.pages WHERE slug = 'privacy'$$,
  '23503',
  NULL,
  'EC1: delete page with revision is refused (RESTRICT FK)'
);

-- EC2: UPDATE a revision as the test runner is refused (no exceptions on page_revisions)
SELECT throws_ok(
  $$UPDATE public.page_revisions SET title = 'hacked'
    WHERE page_id = (SELECT id FROM public.pages WHERE slug = 'privacy')$$,
  'P0001',
  NULL,
  'EC2: UPDATE page_revisions is refused by append-only trigger'
);

-- EC2: UPDATE a revision explicitly as service_role is also refused (no GUC bypass on this table)
SET LOCAL role TO 'service_role';
SELECT throws_ok(
  $$UPDATE public.page_revisions SET title = 'svc_hacked'
    WHERE page_id = (SELECT id FROM public.pages WHERE slug = 'privacy')$$,
  'P0001',
  NULL,
  'EC2: UPDATE page_revisions refused even as service_role'
);
SELECT throws_ok(
  $$DELETE FROM public.page_revisions
    WHERE page_id = (SELECT id FROM public.pages WHERE slug = 'privacy')$$,
  'P0001',
  NULL,
  'EC2: DELETE page_revisions refused even as service_role'
);
RESET role;

-- INSERT revision IS allowed (only blocked operation is UPDATE/DELETE)
SELECT lives_ok(
  $$INSERT INTO public.page_revisions (page_id, version, title)
    SELECT id, 2, 'Privacy v2' FROM public.pages WHERE slug = 'privacy'$$,
  'AC4: INSERT on page_revisions is allowed'
);

-- UNIQUE(page_id, version) — duplicate version refused
SELECT throws_ok(
  $$INSERT INTO public.page_revisions (page_id, version, title)
    SELECT id, 1, 'Dup v1' FROM public.pages WHERE slug = 'privacy'$$,
  'AC3: UNIQUE(page_id,version) is enforced'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- AC5: profiles.terms_revision_id FK and create_profile_for behavior
-- ─────────────────────────────────────────────────────────────────────────────

SELECT has_column('public', 'profiles', 'terms_revision_id',
  'AC5: profiles.terms_revision_id column exists');

-- Raw FK: assigning a non-existent revision_id is refused
SELECT throws_ok(
  $$UPDATE public.profiles
    SET terms_revision_id = '00000000-0000-0000-0000-000000000099'::uuid
    WHERE email = 'cust_found@test.com'$$,
  '23503',
  NULL,
  'AC5: invalid terms_revision_id FK is refused'
);

-- create_profile_for: valid revision_id is stored
DO $$
DECLARE
  v_page  uuid;
  v_rev   uuid;
  v_uid   uuid := '22111111-0000-0000-0000-000000000010'::uuid;
  v_stored uuid;
BEGIN
  -- Create a page and its revision for this test
  INSERT INTO public.pages (locale, slug, title) VALUES ('en', 'test-terms', 'Test Terms')
  RETURNING id INTO v_page;
  INSERT INTO public.page_revisions (page_id, version, title)
  VALUES (v_page, 1, 'Test Terms v1')
  RETURNING id INTO v_rev;

  -- Simulate what create_profile_for does via mock auth.users input
  -- (We call the function directly with a synthetic auth.users row)
  -- Insert into auth.users first so the trigger fires
  INSERT INTO auth.users (
    id, email, raw_user_meta_data, app_metadata,
    aud, role, created_at, updated_at,
    confirmation_token, email_confirmed_at
  ) VALUES (
    v_uid, 'profile_test@test.com',
    jsonb_build_object('first_name', 'Test', 'terms_revision_id', v_rev::text),
    '{"provider":"email"}'::jsonb,
    'authenticated', 'authenticated',
    now(), now(), '', now()
  );

  SELECT terms_revision_id INTO v_stored
  FROM public.profiles WHERE id = v_uid;

  PERFORM ok(v_stored = v_rev, 'AC5: create_profile_for stores valid terms_revision_id');
END;
$$;

-- create_profile_for: non-existent revision_id results in NULL (not error)
DO $$
DECLARE
  v_uid    uuid := '22111111-0000-0000-0000-000000000011'::uuid;
  v_stored uuid;
BEGIN
  INSERT INTO auth.users (
    id, email, raw_user_meta_data, app_metadata,
    aud, role, created_at, updated_at,
    confirmation_token, email_confirmed_at
  ) VALUES (
    v_uid, 'profile_test2@test.com',
    jsonb_build_object('first_name', 'Test2',
      'terms_revision_id', '00000000-0000-0000-0000-000000000000'),
    '{"provider":"email"}'::jsonb,
    'authenticated', 'authenticated',
    now(), now(), '', now()
  );

  SELECT terms_revision_id INTO v_stored
  FROM public.profiles WHERE id = v_uid;

  PERFORM ok(v_stored IS NULL,
    'AC5: create_profile_for stores NULL for non-existent terms_revision_id');
END;
$$;

-- create_profile_for: malformed (non-UUID) revision_id results in NULL (not error, not crash)
DO $$
DECLARE
  v_uid uuid := '22111111-0000-0000-0000-000000000012'::uuid;
  v_stored uuid;
BEGIN
  INSERT INTO auth.users (
    id, email, raw_user_meta_data, app_metadata,
    aud, role, created_at, updated_at,
    confirmation_token, email_confirmed_at
  ) VALUES (
    v_uid, 'profile_test3@test.com',
    jsonb_build_object('first_name', 'Test3', 'terms_revision_id', 'not-a-uuid'),
    '{"provider":"email"}'::jsonb,
    'authenticated', 'authenticated',
    now(), now(), '', now()
  );

  SELECT terms_revision_id INTO v_stored
  FROM public.profiles WHERE id = v_uid;

  PERFORM ok(v_stored IS NULL,
    'AC5: create_profile_for stores NULL for malformed terms_revision_id');
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- AC6: slug_redirects table and constraints
-- ─────────────────────────────────────────────────────────────────────────────

SELECT has_table('public', 'slug_redirects', 'AC6: slug_redirects table exists');
SELECT has_column('public', 'slug_redirects', 'id',          'AC6: slug_redirects.id');
SELECT has_column('public', 'slug_redirects', 'entity_type', 'AC6: slug_redirects.entity_type');
SELECT has_column('public', 'slug_redirects', 'entity_id',   'AC6: slug_redirects.entity_id');
SELECT has_column('public', 'slug_redirects', 'locale',      'AC6: slug_redirects.locale');
SELECT has_column('public', 'slug_redirects', 'old_slug',    'AC6: slug_redirects.old_slug');
SELECT has_column('public', 'slug_redirects', 'created_at',  'AC6: slug_redirects.created_at');

-- entity_type CHECK: invalid value is refused
SELECT throws_ok(
  $$INSERT INTO public.slug_redirects (entity_type, entity_id, old_slug)
    VALUES ('banner', gen_random_uuid(), 'old-slug')$$,
  'AC6: invalid entity_type is refused by CHECK'
);

-- UNIQUE(entity_type, locale, old_slug): duplicate refused
DO $$
DECLARE v_eid uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.slug_redirects (entity_type, entity_id, locale, old_slug)
  VALUES ('article', v_eid, 'en', 'duplicate-slug');
END;
$$;

SELECT throws_ok(
  $$INSERT INTO public.slug_redirects (entity_type, entity_id, locale, old_slug)
    VALUES ('article', gen_random_uuid(), 'en', 'duplicate-slug')$$,
  'AC6: UNIQUE(entity_type, locale, old_slug) is enforced'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- AC7 / EC6 / EC7: site_settings table and group trigger
-- ─────────────────────────────────────────────────────────────────────────────

SELECT has_table('public', 'site_settings', 'AC7: site_settings table exists');

-- Index on setting_group
SELECT has_index('public', 'site_settings', 'idx_site_settings_group',
  'AC7: index on site_settings.setting_group exists');

-- EC7: bad setting_group value is refused by CHECK
SELECT throws_ok(
  $$INSERT INTO public.site_settings (key, value, setting_group)
    VALUES ('test_key', '"x"', 'invalid_group')$$,
  'EC7: setting_group outside 6 values is refused'
);

-- Seed test settings (service_role context — fixture block above)
INSERT INTO public.site_settings (key, value, is_public, setting_group)
VALUES
  ('test_site_key',    '"v"', true,  'site'),
  ('test_contact_key', '"v"', false, 'contact'),
  ('test_system_key',  '"v"', false, 'system');

-- EC6: service_role can update any group — explicitly set role to service_role
SET LOCAL role TO 'service_role';
SELECT lives_ok(
  $$UPDATE public.site_settings SET value = '"svc_site"' WHERE key = 'test_site_key'$$,
  'EC6: service_role can update site group setting'
);
SELECT lives_ok(
  $$UPDATE public.site_settings SET value = '"svc_contact"' WHERE key = 'test_contact_key'$$,
  'EC6: service_role can update contact group setting'
);
SELECT lives_ok(
  $$UPDATE public.site_settings SET value = '"svc_system"' WHERE key = 'test_system_key'$$,
  'EC6: service_role can update system group setting'
);
RESET role;

-- Admin with settings.site CANNOT update contact group (cross-group block)
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"22111111-0000-0000-0000-000000000002","role":"authenticated"}';

SELECT throws_ok(
  $$UPDATE public.site_settings SET value = '"admin_contact"' WHERE key = 'test_contact_key'$$,
  'P0001',
  NULL,
  'AC9/cross-group: admin with settings.site cannot update contact group'
);

-- Admin with settings.site CAN update site group
SELECT lives_ok(
  $$UPDATE public.site_settings SET value = '"admin_site_ok"' WHERE key = 'test_site_key'$$,
  'AC7: admin with settings.site can update site group'
);

-- Admin CANNOT update system group
SELECT throws_ok(
  $$UPDATE public.site_settings SET value = '"admin_sys"' WHERE key = 'test_system_key'$$,
  'P0001',
  NULL,
  'AC9: admin cannot update system group'
);

RESET role;

-- Super Admin CAN update system group
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"22111111-0000-0000-0000-000000000001","role":"authenticated"}';

SELECT lives_ok(
  $$UPDATE public.site_settings SET value = '"sa_sys"' WHERE key = 'test_system_key'$$,
  'AC9: Super Admin can update system group'
);

RESET role;

-- ─────────────────────────────────────────────────────────────────────────────
-- AC8 / AC9: RLS — anon cannot read private settings or media_assets
-- ─────────────────────────────────────────────────────────────────────────────

SET LOCAL role TO anon;

-- Anon cannot read private (is_public=false) setting
SELECT is(
  (SELECT count(*)::int FROM public.site_settings WHERE key = 'test_contact_key'),
  0,
  'AC9: anon cannot read private setting'
);

-- Anon CAN read public setting
SELECT ok(
  (SELECT count(*) FROM public.site_settings WHERE key = 'test_site_key') >= 1,
  'AC8: anon can read public setting'
);

-- Anon cannot read any media_assets row
SELECT is(
  (SELECT count(*)::int FROM public.media_assets),
  0,
  'AC8: anon cannot read any media_assets row'
);

RESET role;

-- Customer cannot read media_assets either
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"22111111-0000-0000-0000-000000000003","role":"authenticated"}';

SELECT is(
  (SELECT count(*)::int FROM public.media_assets),
  0,
  'AC8: customer cannot read media_assets'
);

RESET role;

-- ─────────────────────────────────────────────────────────────────────────────
-- AC8: anon cannot see inactive author; can read active author
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.authors (slug, name, is_active) VALUES
  ('active-author',   'Active Author',   true),
  ('inactive-author', 'Inactive Author', false);

SET LOCAL role TO anon;

SELECT ok(
  (SELECT count(*) FROM public.authors WHERE slug = 'active-author') >= 1,
  'AC8: anon can read active author'
);
SELECT is(
  (SELECT count(*)::int FROM public.authors WHERE slug = 'inactive-author'),
  0,
  'AC8: anon cannot see inactive author'
);

RESET role;

-- ─────────────────────────────────────────────────────────────────────────────
-- AC8: anon can read slug_redirects and pages/page_revisions
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.slug_redirects (entity_type, entity_id, locale, old_slug)
VALUES ('article', gen_random_uuid(), 'en', 'old-article-slug');

SET LOCAL role TO anon;

SELECT ok(
  (SELECT count(*) FROM public.slug_redirects WHERE old_slug = 'old-article-slug') >= 1,
  'AC8: anon can read slug_redirects'
);

SELECT ok(
  (SELECT count(*) FROM public.pages WHERE slug = 'privacy') >= 1,
  'AC8: anon can read pages'
);

SELECT ok(
  (SELECT count(*) FROM public.page_revisions
    WHERE page_id = (SELECT id FROM public.pages WHERE slug = 'privacy')) >= 1,
  'AC8: anon can read page_revisions of existing pages'
);

RESET role;

-- ─────────────────────────────────────────────────────────────────────────────
-- AC9: customer cannot INSERT or UPDATE any of the 7 tables
-- ─────────────────────────────────────────────────────────────────────────────

SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"22111111-0000-0000-0000-000000000003","role":"authenticated"}';

-- INSERT denied
SELECT throws_ok(
  $$INSERT INTO public.categories (slug, name) VALUES ('rls_cat', 'RLS Cat')$$,
  '42501', NULL, 'AC9: customer cannot INSERT into categories'
);
SELECT throws_ok(
  $$INSERT INTO public.authors (slug, name) VALUES ('rls_author', 'RLS Author')$$,
  '42501', NULL, 'AC9: customer cannot INSERT into authors'
);
SELECT throws_ok(
  $$INSERT INTO public.site_settings (key, value, setting_group) VALUES ('rls_key', '"x"', 'site')$$,
  '42501', NULL, 'AC9: customer cannot INSERT into site_settings'
);

-- UPDATE denied
SELECT throws_ok(
  $$UPDATE public.categories SET order_index = 99 WHERE slug = 'ws'$$,
  '42501', NULL, 'AC9: customer cannot UPDATE categories'
);
SELECT throws_ok(
  $$UPDATE public.authors SET order_index = 99 WHERE slug = 'active-author'$$,
  '42501', NULL, 'AC9: customer cannot UPDATE authors'
);
SELECT throws_ok(
  $$UPDATE public.pages SET title = 'hacked' WHERE slug = 'privacy'$$,
  '42501', NULL, 'AC9: customer cannot UPDATE pages'
);
SELECT throws_ok(
  $$UPDATE public.site_settings SET value = '"hacked"' WHERE key = 'test_site_key'$$,
  '42501', NULL, 'AC9: customer cannot UPDATE site_settings'
);

RESET role;

SELECT * FROM finish();
ROLLBACK;
