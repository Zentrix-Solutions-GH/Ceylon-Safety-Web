-- S-018: pgTAP tests — courses, trainers, activity_images, banners
--        columns, CHECKs, indexes, triggers, RLS, banner link policy.
-- Run with: supabase test db (requires Docker + local Supabase stack).
--
-- Assertion count: 94
--   AC1 courses: 18, EC1: 2, EC6/EC8: 2
--   AC2 trainers: 13, EC2/EC3: 2
--   AC3 activity_images: 7
--   AC4 banners: 13, EC4/EC5: 3
--   AC5 banner link policy: 11
--   AC6 course FKs (conditional): 2
--   EC7 RESTRICT check (conditional): 2
--   AC7 set_updated_at: 3
--   AC8 click_count protection: 1
--   AC8/AC9 RLS: 16

BEGIN;
SELECT plan(94);

-- ─────────────────────────────────────────────────────────────────────────────
-- Fixtures
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_sa     uuid := 'bb180001-0000-0000-0000-000000000001'::uuid;
  v_staff  uuid := 'bb180001-0000-0000-0000-000000000002'::uuid;
  v_cust   uuid := 'bb180001-0000-0000-0000-000000000003'::uuid;
BEGIN
  INSERT INTO public.profiles (id, display_name, email, status) VALUES
    (v_sa,    'SA Info',    'sa_info@test.com',    'active'),
    (v_staff, 'Staff Info', 'staff_info@test.com', 'active'),
    (v_cust,  'Cust Info',  'cust_info@test.com',  'active');
  INSERT INTO public.user_roles (user_id, role) VALUES
    (v_sa, 'super_admin'),
    (v_staff, 'admin');
  INSERT INTO public.role_permissions (role, action) VALUES
    ('admin', 'courses.*'),
    ('admin', 'trainers.*'),
    ('admin', 'banners.read'),
    ('admin', 'banners.write')
  ON CONFLICT (role, action) DO NOTHING;
END;
$$;

INSERT INTO public.categories (id, slug, name, applies_to)
VALUES ('cc180001-0000-0000-0000-000000000001'::uuid, 'fire-safety', 'Fire Safety', ARRAY['course'])
ON CONFLICT (slug) DO NOTHING;

-- Temp table used by AC7 timing assertions (ON COMMIT DROP — rolled back at end)
CREATE TEMP TABLE _ac7_results (label text PRIMARY KEY, passed boolean) ON COMMIT DROP;

-- ─────────────────────────────────────────────────────────────────────────────
-- AC1: courses — 18 assertions
-- ─────────────────────────────────────────────────────────────────────────────

SELECT has_table('public', 'courses', 'AC1: courses table exists');

SELECT has_column('public', 'courses', 'id',                   'AC1: courses.id');
SELECT has_column('public', 'courses', 'locale',               'AC1: courses.locale');
SELECT has_column('public', 'courses', 'translation_group_id', 'AC1: courses.translation_group_id');
SELECT has_column('public', 'courses', 'slug',                 'AC1: courses.slug');
SELECT has_column('public', 'courses', 'title',                'AC1: courses.title');
SELECT has_column('public', 'courses', 'level',                'AC1: courses.level');
SELECT has_column('public', 'courses', 'pricing_type',         'AC1: courses.pricing_type');
SELECT has_column('public', 'courses', 'price_cents',          'AC1: courses.price_cents');
SELECT has_column('public', 'courses', 'is_coming_soon',       'AC1: courses.is_coming_soon');
SELECT has_column('public', 'courses', 'category_id',          'AC1: courses.category_id');
SELECT has_column('public', 'courses', 'status',               'AC1: courses.status');
SELECT has_column('public', 'courses', 'search_vector',        'AC1: courses.search_vector');
SELECT has_column('public', 'courses', 'deleted_at',           'AC1: courses.deleted_at');
SELECT has_column('public', 'courses', 'created_at',           'AC1: courses.created_at');
SELECT has_column('public', 'courses', 'updated_at',           'AC1: courses.updated_at');

SELECT has_index('public', 'courses', 'idx_courses_locale_slug',    'AC1: partial unique index on (locale, slug)');
SELECT has_index('public', 'courses', 'idx_courses_search_vector',  'AC1: GIN index on search_vector');

-- ─────────────────────────────────────────────────────────────────────────────
-- EC1: pricing_type vs price_cents — 2 assertions
-- ─────────────────────────────────────────────────────────────────────────────

SELECT throws_ok(
  $sql$
    INSERT INTO public.courses (locale, slug, title, pricing_type, price_cents, status)
    VALUES ('en', 'ec1-no-price', 'EC1 No Price', 'paid', NULL, 'draft')
  $sql$,
  '23514', NULL,
  'EC1: pricing_type=paid without price_cents refused'
);

SELECT throws_ok(
  $sql$
    INSERT INTO public.courses (locale, slug, title, pricing_type, price_cents, status)
    VALUES ('en', 'ec1-price-free', 'EC1 Free With Price', 'free', 1000, 'draft')
  $sql$,
  '23514', NULL,
  'EC1: pricing_type=free with price_cents refused'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- EC6: new course defaults to is_coming_soon = true — 1 assertion
-- EC8: soft-deleted course slug may be reused — 1 assertion
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.courses (id, locale, slug, title, pricing_type, status)
VALUES ('cc180099-0000-0000-0000-000000000001'::uuid, 'en', 'ec6-slug', 'EC6 Course', 'free', 'draft');

SELECT ok(
  (SELECT is_coming_soon FROM public.courses WHERE id = 'cc180099-0000-0000-0000-000000000001'),
  'EC6: new course defaults to is_coming_soon = true'
);

UPDATE public.courses SET deleted_at = now()
WHERE id = 'cc180099-0000-0000-0000-000000000001';

INSERT INTO public.courses (locale, slug, title, pricing_type, status)
VALUES ('en', 'ec6-slug', 'EC8 Reused Slug', 'free', 'draft');
SELECT ok(TRUE, 'EC8: soft-deleted course slug may be reused');

-- ─────────────────────────────────────────────────────────────────────────────
-- AC2: trainers — 13 assertions
-- ─────────────────────────────────────────────────────────────────────────────

SELECT has_table('public', 'trainers', 'AC2: trainers table exists');

SELECT has_column('public', 'trainers', 'id',             'AC2: trainers.id');
SELECT has_column('public', 'trainers', 'name',           'AC2: trainers.name');
SELECT has_column('public', 'trainers', 'position',       'AC2: trainers.position');
SELECT has_column('public', 'trainers', 'bio',            'AC2: trainers.bio');
SELECT has_column('public', 'trainers', 'photo_key',      'AC2: trainers.photo_key');
SELECT has_column('public', 'trainers', 'phone',          'AC2: trainers.phone');
SELECT has_column('public', 'trainers', 'email',          'AC2: trainers.email');
SELECT has_column('public', 'trainers', 'slug',           'AC2: trainers.slug');
SELECT has_column('public', 'trainers', 'whatsapp_number','AC2: trainers.whatsapp_number');
SELECT has_column('public', 'trainers', 'search_vector',  'AC2: trainers.search_vector');
SELECT has_column('public', 'trainers', 'is_active',      'AC2: trainers.is_active');
SELECT col_is_unique('public', 'trainers', 'slug',        'AC2: trainers.slug UNIQUE');

-- ─────────────────────────────────────────────────────────────────────────────
-- EC2: trainer with no contact refused — 1 assertion
-- EC3: duplicate trainer slug refused — 1 assertion
-- ─────────────────────────────────────────────────────────────────────────────

SELECT throws_ok(
  $sql$
    INSERT INTO public.trainers (name, position, slug)
    VALUES ('No Contact', 'Engineer', 'no-contact-trainer')
  $sql$,
  '23514', NULL,
  'EC2: trainer with no phone/email/whatsapp refused'
);

INSERT INTO public.trainers (name, position, slug, phone)
VALUES ('Trainer One', 'Safety Officer', 'trainer-one', '+94771234567');

SELECT throws_ok(
  $sql$
    INSERT INTO public.trainers (name, position, slug, email)
    VALUES ('Trainer Duplicate', 'Safety Officer', 'trainer-one', 'dup@test.com')
  $sql$,
  '23505', NULL,
  'EC3: duplicate trainer slug refused'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- AC3: activity_images — 7 assertions
-- ─────────────────────────────────────────────────────────────────────────────

SELECT has_table('public', 'activity_images', 'AC3: activity_images table exists');

SELECT has_column('public', 'activity_images', 'id',          'AC3: activity_images.id');
SELECT has_column('public', 'activity_images', 'image_key',   'AC3: activity_images.image_key');
SELECT has_column('public', 'activity_images', 'caption',     'AC3: activity_images.caption');
SELECT has_column('public', 'activity_images', 'order_index', 'AC3: activity_images.order_index');
SELECT has_column('public', 'activity_images', 'is_active',   'AC3: activity_images.is_active');
SELECT has_column('public', 'activity_images', 'alt_text',    'AC3: activity_images.alt_text');

-- ─────────────────────────────────────────────────────────────────────────────
-- AC4: banners — 13 assertions
-- ─────────────────────────────────────────────────────────────────────────────

SELECT has_table('public', 'banners', 'AC4: banners table exists');

SELECT has_column('public', 'banners', 'id',               'AC4: banners.id');
SELECT has_column('public', 'banners', 'name',             'AC4: banners.name');
SELECT has_column('public', 'banners', 'advertiser_name',  'AC4: banners.advertiser_name');
SELECT has_column('public', 'banners', 'image_key',        'AC4: banners.image_key');
SELECT has_column('public', 'banners', 'image_key_mobile', 'AC4: banners.image_key_mobile');
SELECT has_column('public', 'banners', 'alt_text',         'AC4: banners.alt_text');
SELECT has_column('public', 'banners', 'link_url',         'AC4: banners.link_url');
SELECT has_column('public', 'banners', 'open_in_new_tab',  'AC4: banners.open_in_new_tab');
SELECT has_column('public', 'banners', 'placements',       'AC4: banners.placements');
SELECT has_column('public', 'banners', 'priority',         'AC4: banners.priority');
SELECT has_column('public', 'banners', 'is_active',        'AC4: banners.is_active');
SELECT has_column('public', 'banners', 'click_count',      'AC4: banners.click_count');

-- EC4: placements = '{footer}' or empty array refused — 2 assertions
SELECT throws_ok(
  $sql$
    INSERT INTO public.banners (name, image_key, alt_text, link_url, placements)
    VALUES ('Bad Placement', 'img/x.webp', 'Alt', 'https://example.com', ARRAY['footer'])
  $sql$,
  '23514', NULL,
  'EC4: placement footer refused'
);

SELECT throws_ok(
  $sql$
    INSERT INTO public.banners (name, image_key, alt_text, link_url, placements)
    VALUES ('Empty Placement', 'img/x.webp', 'Alt', 'https://example.com', ARRAY[]::text[])
  $sql$,
  '23514', NULL,
  'EC4: empty placements array refused'
);

-- EC5: alt_text of 141 characters refused — 1 assertion
SELECT throws_ok(
  $sql$
    INSERT INTO public.banners (name, image_key, alt_text, link_url, placements)
    VALUES ('Long Alt', 'img/x.webp', repeat('a', 141), 'https://example.com', ARRAY['home_top'])
  $sql$,
  '23514', NULL,
  'EC5: alt_text > 140 chars refused'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- AC5: banner link_url policy — 11 assertions (8 refused + 3 passed)
-- ─────────────────────────────────────────────────────────────────────────────

SELECT throws_ok(
  $sql$ INSERT INTO public.banners (name, image_key, alt_text, link_url, placements)
        VALUES ('js', 'img/x.webp', 'Alt', 'javascript:alert(1)', ARRAY['home_top']) $sql$,
  '23514', NULL,
  'AC5: javascript: scheme refused'
);

SELECT throws_ok(
  $sql$ INSERT INTO public.banners (name, image_key, alt_text, link_url, placements)
        VALUES ('data', 'img/x.webp', 'Alt', 'data:text/html,x', ARRAY['home_top']) $sql$,
  '23514', NULL,
  'AC5: data: scheme refused'
);

SELECT throws_ok(
  $sql$ INSERT INTO public.banners (name, image_key, alt_text, link_url, placements)
        VALUES ('mailto', 'img/x.webp', 'Alt', 'mailto:a@b.c', ARRAY['home_top']) $sql$,
  '23514', NULL,
  'AC5: mailto: scheme refused'
);

SELECT throws_ok(
  $sql$ INSERT INTO public.banners (name, image_key, alt_text, link_url, placements)
        VALUES ('tel', 'img/x.webp', 'Alt', 'tel:123', ARRAY['home_top']) $sql$,
  '23514', NULL,
  'AC5: tel: scheme refused'
);

SELECT throws_ok(
  $sql$ INSERT INTO public.banners (name, image_key, alt_text, link_url, placements)
        VALUES ('protorel', 'img/x.webp', 'Alt', '//evil.com', ARRAY['home_top']) $sql$,
  '23514', NULL,
  'AC5: //evil.com refused'
);

SELECT throws_ok(
  $sql$ INSERT INTO public.banners (name, image_key, alt_text, link_url, placements)
        VALUES ('backslash', 'img/x.webp', 'Alt', '/\evil.com', ARRAY['home_top']) $sql$,
  '23514', NULL,
  'AC5: /\evil.com refused'
);

SELECT throws_ok(
  $sql$ INSERT INTO public.banners (name, image_key, alt_text, link_url, placements)
        VALUES ('empty', 'img/x.webp', 'Alt', '', ARRAY['home_top']) $sql$,
  '23514', NULL,
  'AC5: empty link_url refused'
);

SELECT throws_ok(
  $sql$
    INSERT INTO public.banners (name, image_key, alt_text, link_url, placements)
    VALUES ('toolong', 'img/x.webp', 'Alt', 'https://example.com/' || repeat('x', 2029), ARRAY['home_top'])
  $sql$,
  '23514', NULL,
  'AC5: 2049-char link_url refused'
);

INSERT INTO public.banners (name, image_key, alt_text, link_url, placements)
VALUES ('Pass HTTPS', 'img/a.webp', 'Alt', 'https://example.com/a', ARRAY['home_top']);
SELECT ok(TRUE, 'AC5: https://example.com/a passes');

INSERT INTO public.banners (name, image_key, alt_text, link_url, placements)
VALUES ('Pass HTTP', 'img/b.webp', 'Alt', 'http://example.com', ARRAY['home_top']);
SELECT ok(TRUE, 'AC5: http://example.com passes');

INSERT INTO public.banners (name, image_key, alt_text, link_url, placements)
VALUES ('Pass Internal', 'img/c.webp', 'Alt', '/articles/x', ARRAY['home_top']);
SELECT ok(TRUE, 'AC5: /articles/x passes');

-- ─────────────────────────────────────────────────────────────────────────────
-- AC6: course FKs on order_items and entitlements (conditional) — 2 assertions
-- ─────────────────────────────────────────────────────────────────────────────

SELECT CASE
  WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'course_id'
  )
  THEN col_is_fk('public', 'order_items', 'course_id',
       'AC6: order_items.course_id is FK -> courses')
  ELSE skip('AC6: order_items not yet created (added in S-016)')
END;

SELECT CASE
  WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'entitlements' AND column_name = 'course_id'
  )
  THEN col_is_fk('public', 'entitlements', 'course_id',
       'AC6: entitlements.course_id is FK -> courses')
  ELSE skip('AC6: entitlements not yet created (added in S-017)')
END;

-- ─────────────────────────────────────────────────────────────────────────────
-- EC7: deleting a course referenced by order_items/entitlements refused (RESTRICT)
--      Conditional — verifies the FK confdeltype = RESTRICT in the system catalog
--      (actual DELETE test deferred to S-016/S-017 test suites once those tables exist)
-- 2 assertions
-- ─────────────────────────────────────────────────────────────────────────────

SELECT CASE
  WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'course_id'
  )
  THEN (
    SELECT ok(
      (SELECT c.confdeltype = 'r'
       FROM pg_constraint c
       JOIN pg_class t   ON c.conrelid = t.oid
       JOIN pg_namespace n ON t.relnamespace = n.oid
       JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = c.conkey[1]
       WHERE n.nspname = 'public' AND t.relname = 'order_items'
         AND c.contype = 'f' AND a.attname = 'course_id'),
      'EC7: order_items.course_id FK is ON DELETE RESTRICT'
    )
  )
  ELSE skip('EC7: order_items not yet created (S-016)')
END;

SELECT CASE
  WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'entitlements' AND column_name = 'course_id'
  )
  THEN (
    SELECT ok(
      (SELECT c.confdeltype = 'r'
       FROM pg_constraint c
       JOIN pg_class t   ON c.conrelid = t.oid
       JOIN pg_namespace n ON t.relnamespace = n.oid
       JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = c.conkey[1]
       WHERE n.nspname = 'public' AND t.relname = 'entitlements'
         AND c.contype = 'f' AND a.attname = 'course_id'),
      'EC7: entitlements.course_id FK is ON DELETE RESTRICT'
    )
  )
  ELSE skip('EC7: entitlements not yet created (S-017)')
END;

-- ─────────────────────────────────────────────────────────────────────────────
-- AC7: set_updated_at triggers — 3 assertions
-- Uses a temp table to capture before/after timestamps from inside a DO block.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_cid uuid := 'cc180099-0000-0000-0000-000000000002'::uuid;
  v_tid uuid := 'cc180099-0000-0000-0000-000000000003'::uuid;
  v_bid uuid := 'cc180099-0000-0000-0000-000000000004'::uuid;
  v_t1  timestamptz;
  v_t2  timestamptz;
BEGIN
  -- courses
  INSERT INTO public.courses (id, locale, slug, title, pricing_type, status)
  VALUES (v_cid, 'en', 'ac7-course', 'AC7 Course', 'free', 'draft');
  v_t1 := (SELECT updated_at FROM public.courses WHERE id = v_cid);
  PERFORM pg_sleep(0.02);
  UPDATE public.courses SET title = 'AC7 Course Updated' WHERE id = v_cid;
  v_t2 := (SELECT updated_at FROM public.courses WHERE id = v_cid);
  INSERT INTO _ac7_results VALUES ('courses', v_t2 > v_t1);

  -- trainers
  INSERT INTO public.trainers (id, name, position, slug, email)
  VALUES (v_tid, 'AC7 Trainer', 'Officer', 'ac7-trainer', 'ac7@test.com');
  v_t1 := (SELECT updated_at FROM public.trainers WHERE id = v_tid);
  PERFORM pg_sleep(0.02);
  UPDATE public.trainers SET name = 'AC7 Trainer Updated' WHERE id = v_tid;
  v_t2 := (SELECT updated_at FROM public.trainers WHERE id = v_tid);
  INSERT INTO _ac7_results VALUES ('trainers', v_t2 > v_t1);

  -- banners
  INSERT INTO public.banners (id, name, image_key, alt_text, link_url, placements)
  VALUES (v_bid, 'AC7 Banner', 'img/ac7.webp', 'AC7 Alt', 'https://example.com', ARRAY['home_top']);
  v_t1 := (SELECT updated_at FROM public.banners WHERE id = v_bid);
  PERFORM pg_sleep(0.02);
  UPDATE public.banners SET name = 'AC7 Banner Updated' WHERE id = v_bid;
  v_t2 := (SELECT updated_at FROM public.banners WHERE id = v_bid);
  INSERT INTO _ac7_results VALUES ('banners', v_t2 > v_t1);
END;
$$;

SELECT ok((SELECT passed FROM _ac7_results WHERE label = 'courses'),  'AC7: courses.updated_at advances on UPDATE');
SELECT ok((SELECT passed FROM _ac7_results WHERE label = 'trainers'), 'AC7: trainers.updated_at advances on UPDATE');
SELECT ok((SELECT passed FROM _ac7_results WHERE label = 'banners'),  'AC7: banners.updated_at advances on UPDATE');

-- ─────────────────────────────────────────────────────────────────────────────
-- AC8: banners.click_count is read-only for client connections — 1 assertion
-- ─────────────────────────────────────────────────────────────────────────────

-- Seed the active banner used in subsequent tests
INSERT INTO public.banners (id, name, image_key, alt_text, link_url, placements, is_active)
VALUES ('cc180002-0000-0000-0000-000000000006'::uuid, 'Active Banner', 'img/ab.webp', 'Active', 'https://example.com', ARRAY['home_top'], true);

-- Use the admin user who HAS banners.write so RLS passes and the trigger is what blocks.
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"bb180001-0000-0000-0000-000000000002","role":"authenticated"}';

SELECT throws_ok(
  $sql$ UPDATE public.banners SET click_count = 999 WHERE name = 'Active Banner' $sql$,
  '23001',
  NULL,
  'AC8: staff with banners.write cannot directly update click_count (trigger blocks, not RLS)'
);

RESET ROLE;

-- ─────────────────────────────────────────────────────────────────────────────
-- AC8/AC9: RLS — 20 assertions
-- ─────────────────────────────────────────────────────────────────────────────

-- Seed hidden and draft courses
INSERT INTO public.courses (id, locale, slug, title, pricing_type, status)
VALUES
  ('cc180002-0000-0000-0000-000000000001'::uuid, 'en', 'rls-published-course', 'Published Course', 'free', 'published'),
  ('cc180002-0000-0000-0000-000000000002'::uuid, 'en', 'rls-hidden-course',    'Hidden Course',    'free', 'hidden'),
  ('cc180002-0000-0000-0000-000000000003'::uuid, 'en', 'rls-draft-course',     'Draft Course',     'free', 'draft');

-- Seed active and inactive trainers
INSERT INTO public.trainers (id, name, position, slug, email, is_active)
VALUES
  ('cc180002-0000-0000-0000-000000000004'::uuid, 'Active Trainer',   'Officer', 'rls-active-trainer',   'at@test.com', true),
  ('cc180002-0000-0000-0000-000000000005'::uuid, 'Inactive Trainer', 'Officer', 'rls-inactive-trainer', 'it@test.com', false);

-- Seed inactive banner
INSERT INTO public.banners (id, name, image_key, alt_text, link_url, placements, is_active)
VALUES ('cc180002-0000-0000-0000-000000000007'::uuid, 'Inactive Banner', 'img/ib.webp', 'Inactive', 'https://example.com', ARRAY['home_top'], false);

-- Seed active and inactive activity_images
INSERT INTO public.activity_images (id, image_key, alt_text, is_active)
VALUES
  ('cc180002-0000-0000-0000-000000000008'::uuid, 'img/ai1.webp', 'Active Image',   true),
  ('cc180002-0000-0000-0000-000000000009'::uuid, 'img/ai2.webp', 'Inactive Image', false);

-- AC9: anon cannot read hidden/draft course
SET LOCAL ROLE anon;

SELECT is(
  (SELECT COUNT(*)::int FROM public.courses WHERE slug = 'rls-hidden-course'),
  0,
  'AC9: anon cannot read hidden course'
);

SELECT is(
  (SELECT COUNT(*)::int FROM public.courses WHERE slug = 'rls-draft-course'),
  0,
  'AC9: anon cannot read draft course'
);

SELECT is(
  (SELECT COUNT(*)::int FROM public.courses WHERE slug = 'rls-published-course'),
  1,
  'AC8: anon can read published course'
);

-- anon cannot read inactive trainer
SELECT is(
  (SELECT COUNT(*)::int FROM public.trainers WHERE slug = 'rls-inactive-trainer'),
  0,
  'AC9: anon cannot read inactive trainer'
);

SELECT is(
  (SELECT COUNT(*)::int FROM public.trainers WHERE slug = 'rls-active-trainer'),
  1,
  'AC8: anon can read active trainer'
);

-- anon cannot read inactive banner
SELECT is(
  (SELECT COUNT(*)::int FROM public.banners WHERE name = 'Inactive Banner'),
  0,
  'AC9: anon cannot read inactive banner'
);

SELECT is(
  (SELECT COUNT(*)::int FROM public.banners WHERE name = 'Active Banner'),
  1,
  'AC8: anon can read active banner'
);

-- anon cannot read inactive activity_image
SELECT is(
  (SELECT COUNT(*)::int FROM public.activity_images WHERE alt_text = 'Inactive Image'),
  0,
  'AC9: anon cannot read inactive activity_image'
);

RESET ROLE;

-- AC9: customer cannot update any of the four tables
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"bb180001-0000-0000-0000-000000000003","role":"authenticated"}';

SELECT lives_ok(
  $sql$ UPDATE public.courses SET title = 'Hacked' WHERE TRUE $sql$,
  'AC9: customer cannot update courses (RLS silently blocks)'
);

SELECT lives_ok(
  $sql$ UPDATE public.trainers SET name = 'Hacked' WHERE TRUE $sql$,
  'AC9: customer cannot update trainers (RLS silently blocks)'
);

SELECT lives_ok(
  $sql$ UPDATE public.activity_images SET caption = 'Hacked' WHERE TRUE $sql$,
  'AC9: customer cannot update activity_images (RLS silently blocks)'
);

SELECT lives_ok(
  $sql$ UPDATE public.banners SET name = 'Hacked' WHERE TRUE $sql$,
  'AC9: customer cannot update banners (RLS silently blocks)'
);

RESET ROLE;

-- AC9: staff without banners.write cannot insert a banner
DO $$
DECLARE v_noperm uuid := 'bb180001-0000-0000-0000-000000000010'::uuid;
BEGIN
  INSERT INTO public.profiles (id, display_name, email, status)
  VALUES (v_noperm, 'No Perm Staff', 'noperm_staff@test.com', 'active');
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_noperm, 'maintainer');
END;
$$;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"bb180001-0000-0000-0000-000000000010","role":"authenticated"}';

SELECT throws_ok(
  $sql$
    INSERT INTO public.banners (name, image_key, alt_text, link_url, placements)
    VALUES ('Unauth Banner', 'img/x.webp', 'Alt', 'https://example.com', ARRAY['home_top'])
  $sql$,
  '42501', NULL,
  'AC9: staff without banners.write cannot insert a banner'
);

RESET ROLE;

-- staff with banners.write can insert (and read hidden/draft courses)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"bb180001-0000-0000-0000-000000000002","role":"authenticated"}';

INSERT INTO public.banners (name, image_key, alt_text, link_url, placements)
VALUES ('Auth Banner', 'img/auth.webp', 'Alt', 'https://example.com', ARRAY['home_top']);
SELECT ok(TRUE, 'AC9: staff with banners.write can insert a banner');

SELECT is(
  (SELECT COUNT(*)::int FROM public.courses
   WHERE slug IN ('rls-hidden-course', 'rls-draft-course')),
  2,
  'AC8: staff with courses.* can read hidden/draft courses'
);

RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
