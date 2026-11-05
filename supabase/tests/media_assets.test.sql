-- S-047: pgTAP tests — media_assets RLS.
-- Verifies that anon and customer roles cannot read or write media_assets rows,
-- and that a staff member (admin with media.upload) can insert and read their own rows.
-- Run with: supabase test db (requires Docker + local Supabase stack).
--
-- Assertion count: 10

BEGIN;
SELECT plan(10);

-- ─────────────────────────────────────────────────────────────────────────────
-- Fixtures (postgres superuser — bypasses RLS)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_admin  uuid := 'bb047001-0000-4000-8000-000000000001'::uuid;
  v_cust   uuid := 'bb047001-0000-4000-8000-000000000002'::uuid;
BEGIN
  INSERT INTO public.profiles (id, display_name, email, status) VALUES
    (v_admin, 'Admin S047', 'admin_s047@test.com', 'active'),
    (v_cust,  'Cust S047',  'cust_s047@test.com',  'active');

  INSERT INTO public.user_roles (user_id, role) VALUES
    (v_admin, 'admin');

  INSERT INTO public.role_permissions (role, action) VALUES
    ('admin', 'media.upload')
  ON CONFLICT (role, action) DO NOTHING;

  -- Seed one ready row owned by admin, and one pending row
  INSERT INTO public.media_assets (id, bucket, kind, status, file_key, mime_type, uploaded_by) VALUES
    ('bb047001-aaaa-0000-0000-000000000001'::uuid, 'public', 'image', 'ready',   'images/bb047001-aaaa/abc_1200w', 'image/jpeg', v_admin),
    ('bb047001-bbbb-0000-0000-000000000001'::uuid, 'public', 'image', 'pending', 'images/bb047001-bbbb/def_480w',  'image/webp', v_admin);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Anon: cannot read media_assets
-- ─────────────────────────────────────────────────────────────────────────────

SET LOCAL role TO anon;

-- Test 1: anon SELECT returns 0 rows
SELECT is(
  (SELECT count(*)::int FROM public.media_assets),
  0,
  'anon cannot SELECT media_assets'
);

-- Test 2: anon INSERT raises RLS violation (42501)
-- 4-arg form: throws_ok(sql, errcode, expected_message, description)
-- Pass NULL for message so only the SQLSTATE is checked.
SELECT throws_ok(
  $$INSERT INTO public.media_assets (id, bucket, kind, status, file_key, mime_type, uploaded_by)
    VALUES ('bb047001-cccc-0000-0000-000000000001'::uuid, 'public', 'image', 'pending',
            'images/anon/key', 'image/jpeg', 'bb047001-0000-4000-8000-000000000001'::uuid)$$,
  '42501',
  NULL,
  'anon cannot INSERT into media_assets'
);

-- Test 3: anon UPDATE is silently blocked (0 rows affected); verify data unchanged
-- RLS on UPDATE/DELETE does not throw — it returns 0 rows. Verify via superuser after attempt.
DO $$ BEGIN
  UPDATE public.media_assets
     SET mime_type = 'image/png'
   WHERE id = 'bb047001-aaaa-0000-0000-000000000001'::uuid;
END $$;

RESET role;
SELECT is(
  (SELECT mime_type FROM public.media_assets
    WHERE id = 'bb047001-aaaa-0000-0000-000000000001'::uuid),
  'image/jpeg',
  'anon UPDATE has no effect on media_assets'
);
SET LOCAL role TO anon;

-- Test 4: anon DELETE is silently blocked; verify row still exists
DO $$ BEGIN
  DELETE FROM public.media_assets
   WHERE id = 'bb047001-aaaa-0000-0000-000000000001'::uuid;
END $$;

RESET role;
SELECT is(
  (SELECT count(*)::int FROM public.media_assets
    WHERE id = 'bb047001-aaaa-0000-0000-000000000001'::uuid),
  1,
  'anon DELETE has no effect on media_assets'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Customer: cannot read or write media_assets
-- ─────────────────────────────────────────────────────────────────────────────

SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"bb047001-0000-4000-8000-000000000002","role":"authenticated"}';

-- Test 5: customer SELECT returns 0 rows
SELECT is(
  (SELECT count(*)::int FROM public.media_assets),
  0,
  'customer cannot SELECT media_assets'
);

-- Test 6: customer INSERT raises RLS violation (42501)
SELECT throws_ok(
  $$INSERT INTO public.media_assets (id, bucket, kind, status, file_key, mime_type, uploaded_by)
    VALUES ('bb047001-dddd-0000-0000-000000000001'::uuid, 'public', 'image', 'pending',
            'images/cust/key', 'image/jpeg', 'bb047001-0000-4000-8000-000000000002'::uuid)$$,
  '42501',
  NULL,
  'customer cannot INSERT into media_assets'
);

-- Test 7: customer UPDATE is silently blocked; verify data unchanged
DO $$ BEGIN
  UPDATE public.media_assets
     SET mime_type = 'image/png'
   WHERE id = 'bb047001-aaaa-0000-0000-000000000001'::uuid;
END $$;

RESET role;
SELECT is(
  (SELECT mime_type FROM public.media_assets
    WHERE id = 'bb047001-aaaa-0000-0000-000000000001'::uuid),
  'image/jpeg',
  'customer UPDATE has no effect on media_assets'
);
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"bb047001-0000-4000-8000-000000000002","role":"authenticated"}';

-- Test 8: customer DELETE is silently blocked; verify row still exists
DO $$ BEGIN
  DELETE FROM public.media_assets
   WHERE id = 'bb047001-aaaa-0000-0000-000000000001'::uuid;
END $$;

RESET role;
SELECT is(
  (SELECT count(*)::int FROM public.media_assets
    WHERE id = 'bb047001-aaaa-0000-0000-000000000001'::uuid),
  1,
  'customer DELETE has no effect on media_assets'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Admin with media.upload: can read their own rows
-- ─────────────────────────────────────────────────────────────────────────────

SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"bb047001-0000-4000-8000-000000000001","role":"authenticated"}';

SELECT is(
  (SELECT count(*)::int FROM public.media_assets
   WHERE uploaded_by = 'bb047001-0000-4000-8000-000000000001'::uuid),
  2,
  'admin with media.upload can SELECT their own media_assets rows'
);

SELECT is(
  (SELECT count(*)::int FROM public.media_assets
   WHERE uploaded_by != 'bb047001-0000-4000-8000-000000000001'::uuid),
  0,
  'admin cannot SELECT other users media_assets rows'
);

RESET role;

SELECT * FROM finish();
ROLLBACK;
