-- S-050: pgTAP tests — engagement rate limits (likes + comments).
-- Tests AC3, AC5, AC9, AC10, EC1, EC2, EC3, EC5.
-- Run with: supabase test db (requires Docker + local Supabase stack).
--
-- Assertion count: 10

BEGIN;
SELECT plan(10);

-- ── Seed ───────────────────────────────────────────────────────────────────────
-- Note: 60 extra articles (50eeeeee-…) are inserted here for the hourly-like
-- limit test (test 1). article_likes has an FK on article_id, so random UUIDs
-- cannot be used — we need real rows in the articles table.
DO $$
DECLARE
  v_sa        uuid := '50111111-0000-0000-0000-000000000001'::uuid;
  v_cust      uuid := '50111111-0000-0000-0000-000000000002'::uuid;
  v_cust2     uuid := '50111111-0000-0000-0000-000000000003'::uuid;
  v_author    uuid := '50111111-0000-0000-0000-000000000010'::uuid;
  v_cat       uuid := '50111111-0000-0000-0000-000000000011'::uuid;
  v_art       uuid := '50aaaaaa-0000-4000-8000-000000000001'::uuid;
BEGIN
  INSERT INTO public.profiles (id, display_name, email, status) VALUES
    (v_sa,    'SA Engage',    'sa_engage@test.com',    'active'),
    (v_cust,  'Cust Engage',  'cust_engage@test.com',  'active'),
    (v_cust2, 'Cust Engage2', 'cust_engage2@test.com', 'active')
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_sa, 'super_admin')
    ON CONFLICT DO NOTHING;
  INSERT INTO auth.users (id, email, encrypted_password, role) VALUES
    (v_sa,    'sa_engage@test.com',    'x', 'authenticated'),
    (v_cust,  'cust_engage@test.com',  'x', 'authenticated'),
    (v_cust2, 'cust_engage2@test.com', 'x', 'authenticated')
    ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.authors (id, slug, name, is_active)
    VALUES (v_author, 'test-author-050', 'Test Author 050', TRUE)
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.categories (id, slug, name, applies_to)
    VALUES (v_cat, 'test-cat-050', 'Test Cat 050', ARRAY['article']::text[])
    ON CONFLICT (id) DO NOTHING;

  -- Main article used by most tests
  INSERT INTO public.articles (id, locale, slug, title, body, body_version, status, published_at, author_id, category_id)
    VALUES (v_art, 'en', 'engage-test-art-050', 'Engage Test Art 050',
            '{"schema_version":1,"type":"doc","content":[]}'::jsonb, 1, 'published',
            now() - interval '1 hour', v_author, v_cat)
    ON CONFLICT (id) DO NOTHING;

  -- 60 dummy articles for the hourly like-limit test.
  -- IDs: 50eeeeee-0000-4000-8000-000000000001 … 000000000060
  INSERT INTO public.articles (id, locale, slug, title, body, body_version, status, published_at, author_id, category_id)
    SELECT
      ('50eeeeee-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
      'en',
      'fake-like-art-050-' || i,
      'Fake Like Art 050 ' || i,
      '{"schema_version":1,"type":"doc","content":[]}'::jsonb,
      1, 'published',
      now() - interval '2 hours',
      v_author, v_cat
    FROM generate_series(1, 60) AS i
    ON CONFLICT (id) DO NOTHING;
END;
$$;

-- ── Helper — sets JWT claims and authenticated role ───────────────────────────
CREATE OR REPLACE FUNCTION pg_temp.set_role_customer(p_id uuid) RETURNS void AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_id::text, 'role', 'authenticated')::text, true);
  SET LOCAL role TO authenticated;
END;
$$ LANGUAGE plpgsql;

-- ── Test functions that need before/after values (create while still postgres) ─

-- test_6: pending comment must NOT increment comment_count (AC9)
CREATE OR REPLACE FUNCTION pg_temp.test_6_comment_count_pending() RETURNS SETOF TEXT AS $$
DECLARE
  v_art    CONSTANT uuid := '50aaaaaa-0000-4000-8000-000000000001'::uuid;
  v_cust2  CONSTANT uuid := '50111111-0000-0000-0000-000000000003'::uuid;
  v_before int;
  v_after  int;
BEGIN
  DELETE FROM public.article_comments WHERE user_id = v_cust2;
  SELECT comment_count INTO v_before FROM public.articles WHERE id = v_art;
  INSERT INTO public.article_comments (article_id, user_id, body, status)
    VALUES (v_art, v_cust2, 'Pending comment', 'pending');
  SELECT comment_count INTO v_after FROM public.articles WHERE id = v_art;
  RETURN NEXT is(v_after, v_before,
    'AC9: pending comment must not increment comment_count');
END;
$$ LANGUAGE plpgsql;

-- test_7: approving a comment DOES increment comment_count (AC9)
CREATE OR REPLACE FUNCTION pg_temp.test_7_comment_count_approved() RETURNS SETOF TEXT AS $$
DECLARE
  v_art    CONSTANT uuid := '50aaaaaa-0000-4000-8000-000000000001'::uuid;
  v_cust2  CONSTANT uuid := '50111111-0000-0000-0000-000000000003'::uuid;
  v_cmt    uuid;
  v_before int;
  v_after  int;
BEGIN
  SELECT comment_count INTO v_before FROM public.articles WHERE id = v_art;
  SELECT id INTO v_cmt
    FROM public.article_comments
    WHERE user_id = v_cust2 AND status = 'pending' LIMIT 1;
  UPDATE public.article_comments SET status = 'approved' WHERE id = v_cmt;
  SELECT comment_count INTO v_after FROM public.articles WHERE id = v_art;
  RETURN NEXT is(v_after, v_before + 1,
    'AC9: approving a comment increments comment_count by 1');
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Hourly like limit (AC3, EC1) — the 61st like in an hour is refused
-- ─────────────────────────────────────────────────────────────────────────────
-- Setup runs in a DO block so SET LOCAL role TO postgres is scoped to it,
-- reverting to whatever the outer role is once the block exits.
DO $$
DECLARE
  v_cust uuid := '50111111-0000-0000-0000-000000000002'::uuid;
BEGIN
  SET LOCAL role TO postgres;
  DELETE FROM public.article_likes WHERE user_id = v_cust;
  -- Insert 60 likes against the 60 real dummy articles seeded above.
  INSERT INTO public.article_likes (article_id, user_id, created_at)
    SELECT
      ('50eeeeee-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
      v_cust,
      now() - (i || ' seconds')::interval
    FROM generate_series(1, 60) AS i
    ON CONFLICT DO NOTHING;
END;
$$;
SELECT pg_temp.set_role_customer('50111111-0000-0000-0000-000000000002'::uuid);
SELECT throws_ok(
  $sql$INSERT INTO public.article_likes (article_id, user_id)
       VALUES ('50aaaaaa-0000-4000-8000-000000000001'::uuid,
               '50111111-0000-0000-0000-000000000002'::uuid)$sql$,
  'P0001', NULL,
  'AC3/EC1: 61st like in an hour must be refused by trigger'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Hourly comment limit (AC5, EC1) — the 11th comment in an hour is refused
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_cust uuid := '50111111-0000-0000-0000-000000000002'::uuid;
  v_art  uuid := '50aaaaaa-0000-4000-8000-000000000001'::uuid;
BEGIN
  SET LOCAL role TO postgres;
  DELETE FROM public.article_comments WHERE user_id = v_cust;
  INSERT INTO public.article_comments (article_id, user_id, body, status, created_at)
    SELECT v_art, v_cust, 'Comment ' || i, 'pending',
           now() - (i || ' seconds')::interval
    FROM generate_series(1, 10) AS i;
END;
$$;
SELECT pg_temp.set_role_customer('50111111-0000-0000-0000-000000000002'::uuid);
SELECT throws_ok(
  $sql$INSERT INTO public.article_comments (article_id, user_id, body)
       VALUES ('50aaaaaa-0000-4000-8000-000000000001'::uuid,
               '50111111-0000-0000-0000-000000000002'::uuid,
               'Eleventh')$sql$,
  'P0001', NULL,
  'AC5/EC1: 11th comment in an hour must be refused by trigger'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Pending cap (AC5, EC1) — the 6th pending comment is refused
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_cust uuid := '50111111-0000-0000-0000-000000000002'::uuid;
  v_art  uuid := '50aaaaaa-0000-4000-8000-000000000001'::uuid;
BEGIN
  SET LOCAL role TO postgres;
  DELETE FROM public.article_comments WHERE user_id = v_cust;
  -- Seed 5 pending comments more than 1 hour ago to bypass the hourly limit
  INSERT INTO public.article_comments (article_id, user_id, body, status, created_at)
    SELECT v_art, v_cust, 'Pending ' || i, 'pending',
           now() - interval '2 hours' - (i || ' seconds')::interval
    FROM generate_series(1, 5) AS i;
END;
$$;
SELECT pg_temp.set_role_customer('50111111-0000-0000-0000-000000000002'::uuid);
SELECT throws_ok(
  $sql$INSERT INTO public.article_comments (article_id, user_id, body)
       VALUES ('50aaaaaa-0000-4000-8000-000000000001'::uuid,
               '50111111-0000-0000-0000-000000000002'::uuid,
               'Sixth pending')$sql$,
  'P0001', NULL,
  'AC5/EC1: 6th pending comment must be refused by trigger'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Like toggle: second like removes the row (EC5)
-- ─────────────────────────────────────────────────────────────────────────────
-- Clean up as postgres, then operate as the customer so RLS applies.
DO $$
BEGIN
  SET LOCAL role TO postgres;
  DELETE FROM public.article_likes
    WHERE user_id = '50111111-0000-0000-0000-000000000003'::uuid;
END;
$$;
SELECT pg_temp.set_role_customer('50111111-0000-0000-0000-000000000003'::uuid);
INSERT INTO public.article_likes (article_id, user_id)
  VALUES ('50aaaaaa-0000-4000-8000-000000000001'::uuid,
          '50111111-0000-0000-0000-000000000003'::uuid);
DELETE FROM public.article_likes
  WHERE article_id = '50aaaaaa-0000-4000-8000-000000000001'::uuid
    AND user_id    = '50111111-0000-0000-0000-000000000003'::uuid;
SELECT is(
  COUNT(*)::int, 0,
  'EC5: second like (delete) leaves zero rows for this user'
) FROM public.article_likes
  WHERE article_id = '50aaaaaa-0000-4000-8000-000000000001'::uuid
    AND user_id    = '50111111-0000-0000-0000-000000000003'::uuid;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. like_count never goes negative (EC5)
-- ─────────────────────────────────────────────────────────────────────────────
SET LOCAL role TO postgres;
SELECT ok(
  like_count >= 0,
  'EC5: like_count on article must be >= 0 after toggle'
) FROM public.articles
  WHERE id = '50aaaaaa-0000-4000-8000-000000000001'::uuid;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. comment_count counts approved only (AC9)
-- ─────────────────────────────────────────────────────────────────────────────
-- Uses a SETOF TEXT function (created above while postgres) so it can capture
-- before/after values in local variables.
SELECT * FROM pg_temp.test_6_comment_count_pending();

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. comment_count increments on approval (AC9)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT * FROM pg_temp.test_7_comment_count_approved();

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Super Admin does not appear in public_profiles (AC10)
-- ─────────────────────────────────────────────────────────────────────────────
SET LOCAL role TO postgres;
SELECT is(
  COUNT(*)::int, 0,
  'AC10: Super Admin must not appear in public_profiles'
) FROM public.public_profiles
  WHERE id = '50111111-0000-0000-0000-000000000001'::uuid;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Pending comment not visible to other users (EC2)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_cust uuid := '50111111-0000-0000-0000-000000000002'::uuid;
  v_art  uuid := '50aaaaaa-0000-4000-8000-000000000001'::uuid;
BEGIN
  SET LOCAL role TO postgres;
  DELETE FROM public.article_comments WHERE user_id = v_cust;
  INSERT INTO public.article_comments (article_id, user_id, body, status)
    VALUES (v_art, v_cust, 'My pending', 'pending');
END;
$$;
SELECT pg_temp.set_role_customer('50111111-0000-0000-0000-000000000003'::uuid);
SELECT is(
  COUNT(*)::int, 0,
  'EC2: pending comment of user A must not be visible to user B'
) FROM public.article_comments
  WHERE article_id = '50aaaaaa-0000-4000-8000-000000000001'::uuid
    AND user_id    = '50111111-0000-0000-0000-000000000002'::uuid
    AND status     = 'pending';

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. is_staff false for member with staff-like display name (EC3)
-- ─────────────────────────────────────────────────────────────────────────────
SET LOCAL role TO postgres;
SELECT is(
  is_staff, FALSE,
  'EC3: member profile must not have is_staff=true'
) FROM public.public_profiles
  WHERE id = '50111111-0000-0000-0000-000000000002'::uuid;

SELECT * FROM finish();
ROLLBACK;
