-- S-020: Seed data verification tests
-- Counts, has_permission, RLS, and idempotency checks.
-- Run with: supabase test db supabase/tests/seed.test.sql
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;
SELECT * FROM no_plan();

-- ─────────────────────────────────────────────────────────────────────────────
-- AC1 — 8 categories with correct shape
-- ─────────────────────────────────────────────────────────────────────────────

SELECT is(
  (SELECT count(*)::int FROM public.categories),
  8,
  'AC1: exactly 8 categories seeded'
);

SELECT ok(
  (SELECT bool_and(slug IS NOT NULL AND slug != '') FROM public.categories),
  'AC1: every category has a non-empty slug'
);

SELECT ok(
  (SELECT bool_and(cardinality(applies_to) > 0) FROM public.categories),
  'AC1: every category has at least one applies_to value'
);

SELECT ok(
  EXISTS (SELECT 1 FROM public.categories WHERE name = 'Workplace Safety'),
  'AC1: Workplace Safety category exists'
);
SELECT ok(
  EXISTS (SELECT 1 FROM public.categories WHERE name = 'Fire Safety'),
  'AC1: Fire Safety category exists'
);
SELECT ok(
  EXISTS (SELECT 1 FROM public.categories WHERE name = 'First Aid'),
  'AC1: First Aid category exists'
);
SELECT ok(
  EXISTS (SELECT 1 FROM public.categories WHERE name = 'Electrical Safety'),
  'AC1: Electrical Safety category exists'
);
SELECT ok(
  EXISTS (SELECT 1 FROM public.categories WHERE name = 'Construction Safety'),
  'AC1: Construction Safety category exists'
);
SELECT ok(
  EXISTS (SELECT 1 FROM public.categories WHERE name = 'Food Safety'),
  'AC1: Food Safety category exists'
);
SELECT ok(
  EXISTS (SELECT 1 FROM public.categories WHERE name = 'Chemical Safety'),
  'AC1: Chemical Safety category exists'
);
SELECT ok(
  EXISTS (SELECT 1 FROM public.categories WHERE name = 'Occupational Health'),
  'AC1: Occupational Health category exists'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- AC2 — site_settings: all keys present with a valid setting_group
-- ─────────────────────────────────────────────────────────────────────────────

SELECT ok(
  (SELECT bool_and(setting_group IN ('site','contact','business','analytics','ads','system'))
   FROM public.site_settings),
  'AC2: every setting_group is a valid value'
);

-- Spot-check required keys exist
SELECT ok(
  EXISTS (SELECT 1 FROM public.site_settings WHERE key = 'default_download_limit'),
  'AC2: default_download_limit key present'
);
SELECT ok(
  EXISTS (SELECT 1 FROM public.site_settings WHERE key = 'bank_order_expiry_days'),
  'AC2: bank_order_expiry_days key present'
);
SELECT ok(
  EXISTS (SELECT 1 FROM public.site_settings WHERE key = 'bank_order_warning_days'),
  'AC2: bank_order_warning_days key present'
);
SELECT ok(
  EXISTS (SELECT 1 FROM public.site_settings WHERE key = 'ads_enabled'),
  'AC2: ads_enabled key present'
);
SELECT ok(
  EXISTS (SELECT 1 FROM public.site_settings WHERE key = 'banner_rotation_seconds'),
  'AC2: banner_rotation_seconds key present'
);
SELECT ok(
  EXISTS (SELECT 1 FROM public.site_settings WHERE key = 'idle_account_years'),
  'AC2: idle_account_years key present'
);
SELECT ok(
  EXISTS (SELECT 1 FROM public.site_settings WHERE key = 'idle_warning_days'),
  'AC2: idle_warning_days key present'
);

-- Default values
SELECT is(
  (SELECT value FROM public.site_settings WHERE key = 'default_download_limit'),
  '1'::jsonb,
  'AC2: default_download_limit = 1'
);
SELECT is(
  (SELECT value FROM public.site_settings WHERE key = 'bank_order_expiry_days'),
  '7'::jsonb,
  'AC2: bank_order_expiry_days = 7'
);
SELECT is(
  (SELECT value FROM public.site_settings WHERE key = 'ads_enabled'),
  'false'::jsonb,
  'AC2: ads_enabled = false'
);
SELECT is(
  (SELECT value FROM public.site_settings WHERE key = 'banner_rotation_seconds'),
  '6'::jsonb,
  'AC2: banner_rotation_seconds = 6'
);

-- Private keys must NOT be public
SELECT ok(
  NOT (SELECT is_public FROM public.site_settings WHERE key = 'default_download_limit'),
  'AC2/EC4: default_download_limit is private'
);
SELECT ok(
  NOT (SELECT is_public FROM public.site_settings WHERE key = 'bank_order_expiry_days'),
  'AC2/EC4: bank_order_expiry_days is private'
);
SELECT ok(
  NOT (SELECT is_public FROM public.site_settings WHERE key = 'bank_order_warning_days'),
  'AC2/EC4: bank_order_warning_days is private'
);
SELECT ok(
  NOT (SELECT is_public FROM public.site_settings WHERE key = 'staff_notification_emails'),
  'AC2/EC4: staff_notification_emails is private'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- AC3 — 6 pages each with a version 1 revision
-- ─────────────────────────────────────────────────────────────────────────────

SELECT is(
  (SELECT count(*)::int FROM public.pages WHERE slug IN (
    'terms','privacy','refund-policy','disclaimer','contact-coach-intro','contact-coach-services'
  )),
  6,
  'AC3: 6 seed pages exist'
);

SELECT is(
  (SELECT count(*)::int FROM public.page_revisions pr
   JOIN public.pages p ON p.id = pr.page_id
   WHERE p.slug IN (
     'terms','privacy','refund-policy','disclaimer','contact-coach-intro','contact-coach-services'
   ) AND pr.version = 1),
  6,
  'AC3: each page has a version 1 revision'
);

-- All seeded revisions are drafts (published_at IS NULL)
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public.page_revisions pr
    JOIN public.pages p ON p.id = pr.page_id
    WHERE p.slug IN (
      'terms','privacy','refund-policy','disclaimer','contact-coach-intro','contact-coach-services'
    ) AND pr.version = 1 AND pr.published_at IS NOT NULL
  ),
  'AC3: all seeded page revisions are draft (published_at IS NULL)'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- AC4 — role_permissions: admin has the right rows, maintainer has none
-- ─────────────────────────────────────────────────────────────────────────────

-- Admin permission count
SELECT is(
  (SELECT count(*)::int FROM public.role_permissions WHERE role = 'admin'),
  18,
  'AC4: admin has exactly 18 role_permissions rows'
);

-- No rows for maintainer
SELECT is(
  (SELECT count(*)::int FROM public.role_permissions WHERE role = 'maintainer'),
  0,
  'AC4: maintainer has 0 role_permissions rows'
);

-- No rows for super_admin (SA always passes via has_permission logic)
SELECT is(
  (SELECT count(*)::int FROM public.role_permissions WHERE role = 'super_admin'),
  0,
  'AC4: super_admin has 0 role_permissions rows (SA bypasses the table)'
);

-- Spot-check specific admin permissions
SELECT ok(
  EXISTS (SELECT 1 FROM public.role_permissions WHERE role = 'admin' AND action = 'articles.*'),
  'AC4: admin has articles.*'
);
SELECT ok(
  EXISTS (SELECT 1 FROM public.role_permissions WHERE role = 'admin' AND action = 'documents.*'),
  'AC4: admin has documents.*'
);
SELECT ok(
  EXISTS (SELECT 1 FROM public.role_permissions WHERE role = 'admin' AND action = 'settings.site'),
  'AC4: admin has settings.site'
);
SELECT ok(
  EXISTS (SELECT 1 FROM public.role_permissions WHERE role = 'admin' AND action = 'users.suspend'),
  'AC4: admin has users.suspend'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- AC4 — has_permission function: admin, maintainer, super_admin
-- ─────────────────────────────────────────────────────────────────────────────

-- Fixtures: admin profile + user_role, maintainer profile + user_role, SA
INSERT INTO public.profiles (id, display_name, email, status)
VALUES
  ('02000001-0000-0000-0000-000000000001', 'S020 Admin',       's020.admin@test.invalid',  'active'),
  ('02000001-0000-0000-0000-000000000002', 'S020 Maintainer',  's020.maint@test.invalid',  'active'),
  ('02000001-0000-0000-0000-000000000003', 'S020 SA',          's020.sa@test.invalid',     'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role, granted_by)
VALUES
  ('02000001-0000-0000-0000-000000000001', 'admin',       '02000001-0000-0000-0000-000000000003'),
  ('02000001-0000-0000-0000-000000000002', 'maintainer',  '02000001-0000-0000-0000-000000000003'),
  ('02000001-0000-0000-0000-000000000003', 'super_admin', '02000001-0000-0000-0000-000000000003')
ON CONFLICT DO NOTHING;

-- Admin: has articles.write (matches articles.* wildcard)
SET LOCAL role TO authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"02000001-0000-0000-0000-000000000001","role":"authenticated"}';
SELECT ok(
  public.has_permission('articles.write'),
  'AC4: admin has_permission(articles.write) = true via wildcard'
);

-- Admin: has documents.publish (matches documents.*)
SELECT ok(
  public.has_permission('documents.publish'),
  'AC4: admin has_permission(documents.publish) = true via wildcard'
);

-- Admin: does NOT have pages.publish_legal (super admin only)
SELECT ok(
  NOT public.has_permission('pages.publish_legal'),
  'AC4: admin has_permission(pages.publish_legal) = false (SA only)'
);

-- Reset to service_role for fixture cleanup
RESET role;

-- Maintainer: deny-by-default, has no rows
SET LOCAL role TO authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"02000001-0000-0000-0000-000000000002","role":"authenticated"}';
SELECT ok(
  NOT public.has_permission('articles.write'),
  'AC4: maintainer has_permission(articles.write) = false (no rows)'
);
SELECT ok(
  NOT public.has_permission('documents.*'),
  'AC4: maintainer has_permission(documents.*) = false (no rows)'
);

RESET role;

-- Super Admin: passes everything
SET LOCAL role TO authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"02000001-0000-0000-0000-000000000003","role":"authenticated"}';
SELECT ok(
  public.has_permission('pages.publish_legal'),
  'AC4: super_admin has_permission(pages.publish_legal) = true (SA always passes)'
);
SELECT ok(
  public.has_permission('audit.read'),
  'AC4: super_admin has_permission(audit.read) = true (SA always passes)'
);

RESET role;

-- ─────────────────────────────────────────────────────────────────────────────
-- AC5 — trainers and courses seeded
-- ─────────────────────────────────────────────────────────────────────────────

SELECT is(
  (SELECT count(*)::int FROM public.trainers),
  3,
  'AC5: exactly 3 trainers seeded'
);

SELECT ok(
  (SELECT bool_and(slug IS NOT NULL AND slug != '') FROM public.trainers),
  'AC5: every trainer has a slug'
);

SELECT is(
  (SELECT count(*)::int FROM public.courses WHERE is_coming_soon = true),
  4,
  'AC5: 4 courses seeded with is_coming_soon = true'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- AC8 — migration test counts
-- ─────────────────────────────────────────────────────────────────────────────

SELECT is(
  (SELECT count(*)::int FROM public.categories),
  8,
  'AC8: count 8 categories'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public.site_settings WHERE setting_group IS NULL
  ),
  'AC8: all setting keys have a setting_group'
);

SELECT is(
  (SELECT count(*)::int FROM public.pages WHERE slug IN (
    'terms','privacy','refund-policy','disclaimer','contact-coach-intro','contact-coach-services'
  )),
  6,
  'AC8: count 6 seed pages'
);

SELECT is(
  (SELECT count(*)::int FROM public.role_permissions WHERE role = 'admin'),
  18,
  'AC8: role_permissions rows only for admin (18)'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- EC1 — idempotency: inserting duplicate categories is safe
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.categories (slug, name, applies_to, order_index)
VALUES ('workplace-safety', 'Workplace Safety', ARRAY['article','video','document','course'], 1)
ON CONFLICT (slug) DO NOTHING;

SELECT is(
  (SELECT count(*)::int FROM public.categories WHERE slug = 'workplace-safety'),
  1,
  'EC1: duplicate category insert is idempotent'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- EC4 — private setting invisible to anon (tested via is_public=false assertion)
-- (RLS as anon is tested in zz-schema-verification; here we assert the flag)
-- ─────────────────────────────────────────────────────────────────────────────

SELECT ok(
  NOT (SELECT is_public FROM public.site_settings WHERE key = 'default_download_limit'),
  'EC4: default_download_limit is_public = false'
);

SELECT * FROM finish();
ROLLBACK;
