-- S-099: pgTAP test — AC7: group-check trigger refuses a write to a Super Admin group
-- from an authenticated user whose role is 'admin' (not 'super_admin').
-- Run with: supabase test db (requires Docker + local Supabase stack).
--
-- Assertion count: 6

BEGIN;
SELECT plan(6);

-- ─────────────────────────────────────────────────────────────────────────────
-- Fixtures (postgres / service role; all rolled back after the test)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_sa    uuid := '99100000-0000-0000-0000-000000000001'::uuid;
  v_admin uuid := '99100000-0000-0000-0000-000000000002'::uuid;
BEGIN
  INSERT INTO public.profiles (id, display_name, email, status) VALUES
    (v_sa,    'SA Settings',    'sa_settings@test.invalid',    'active'),
    (v_admin, 'Admin Settings', 'admin_settings@test.invalid', 'active');
  INSERT INTO public.user_roles (user_id, role) VALUES
    (v_sa,    'super_admin'),
    (v_admin, 'admin');
  INSERT INTO public.role_permissions (role, action) VALUES
    ('admin', 'settings.site')
  ON CONFLICT (role, action) DO NOTHING;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Test 1: site_settings table exists
-- ─────────────────────────────────────────────────────────────────────────────
SELECT has_table('public', 'site_settings', 'S-099: site_settings table exists');

-- ─────────────────────────────────────────────────────────────────────────────
-- Test 2: group-check trigger exists on the table
-- ─────────────────────────────────────────────────────────────────────────────
SELECT has_trigger('public', 'site_settings', 'trg_site_settings_group_check',
  'S-099: group-check trigger exists');

-- ─────────────────────────────────────────────────────────────────────────────
-- Test 3: simulate service-role write (the trigger early-returns when
-- current_setting('role') = 'service_role'). pgTAP runs as postgres, not
-- the Supabase service_role JWT, so we set the GUC directly.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT set_config('role', 'service_role', true);

SELECT lives_ok(
  $q$
    UPDATE public.site_settings
       SET value = '"sa_test@ceylonsafety.lk"'::jsonb
     WHERE key = 'contact_email';
  $q$,
  'S-099: service role can update contact group row'
);

-- Reset role back to postgres before switching to authenticated.
RESET ROLE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Test 4: Admin user (settings.site only) blocked from contact-group row
-- Switch to authenticated role and set JWT claim to admin user.
-- SET ROLE at top level (not inside DO) so the role applies to the
-- subsequent throws_ok() call.
-- PERFORM is PL/pgSQL syntax; use SELECT at top-level SQL.
-- ─────────────────────────────────────────────────────────────────────────────
SET ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub',  '99100000-0000-0000-0000-000000000002',
    'role', 'authenticated'
  )::text,
  true
);

SELECT throws_ok(
  $q$
    UPDATE public.site_settings
       SET value = '"hacked@evil.com"'::jsonb
     WHERE key = 'contact_email';
  $q$,
  '23001',
  'S-099: Admin cannot update contact-group row (trigger RAISE restrict_violation)'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Test 5: Admin CAN update a site-group row (settings.site permission).
-- Still running as authenticated / admin JWT from test 4.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT lives_ok(
  $q$
    UPDATE public.site_settings
       SET value = '"CeylonSafety Test"'::jsonb
     WHERE key = 'footer_business_name';
  $q$,
  'S-099: Admin can update site-group row'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Test 6: Anon role cannot read a private (is_public=false) setting
-- Reset to postgres first so SET ROLE anon is allowed.
-- ─────────────────────────────────────────────────────────────────────────────
RESET ROLE;
SET ROLE anon;

SELECT is(
  (SELECT count(*)::int FROM public.site_settings WHERE key = 'bank_account_details' AND is_public = false),
  0,
  'S-099: anon cannot read is_public=false settings'
);

RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
