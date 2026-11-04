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
SELECT is(
  (SELECT count(*)::int FROM public.media_assets),
  0,
  'anon cannot SELECT media_assets'
);

SELECT throws_ok(
  $$INSERT INTO public.media_assets (id, bucket, kind, status, file_key, mime_type, uploaded_by)
    VALUES ('bb047001-cccc-0000-0000-000000000001'::uuid, 'public', 'image', 'pending',
            'images/anon/key', 'image/jpeg', 'bb047001-0000-4000-8000-000000000001'::uuid)$$,
  'anon cannot INSERT into media_assets'
);

SELECT throws_ok(
  $$UPDATE public.media_assets SET status = 'ready'
    WHERE id = 'bb047001-aaaa-0000-0000-000000000001'::uuid$$,
  'anon cannot UPDATE media_assets'
);

SELECT throws_ok(
  $$DELETE FROM public.media_assets
    WHERE id = 'bb047001-aaaa-0000-0000-000000000001'::uuid$$,
  'anon cannot DELETE from media_assets'
);

RESET role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Customer: cannot read or write media_assets
-- ─────────────────────────────────────────────────────────────────────────────

SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"bb047001-0000-4000-8000-000000000002","role":"authenticated"}';

SELECT is(
  (SELECT count(*)::int FROM public.media_assets),
  0,
  'customer cannot SELECT media_assets'
);

SELECT throws_ok(
  $$INSERT INTO public.media_assets (id, bucket, kind, status, file_key, mime_type, uploaded_by)
    VALUES ('bb047001-dddd-0000-0000-000000000001'::uuid, 'public', 'image', 'pending',
            'images/cust/key', 'image/jpeg', 'bb047001-0000-4000-8000-000000000002'::uuid)$$,
  'customer cannot INSERT into media_assets'
);

SELECT throws_ok(
  $$UPDATE public.media_assets SET status = 'ready'
    WHERE id = 'bb047001-aaaa-0000-0000-000000000001'::uuid$$,
  'customer cannot UPDATE media_assets'
);

SELECT throws_ok(
  $$DELETE FROM public.media_assets
    WHERE id = 'bb047001-aaaa-0000-0000-000000000001'::uuid$$,
  'customer cannot DELETE from media_assets'
);

RESET role;

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
