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
-- AC7: group-check trigger enforces permission at DB level
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. site_settings table exists
SELECT has_table('public', 'site_settings', 'S-099: site_settings table exists');

-- 2. trigger exists on the table
SELECT has_trigger('public', 'site_settings', 'trg_site_settings_group_check',
  'S-099: group-check trigger exists');

-- 3. Super Admin can update a contact-group row (direct DB write as service role succeeds)
SELECT lives_ok(
  $q$
    UPDATE public.site_settings
       SET value = '"sa_test@ceylonsafety.lk"'::jsonb
     WHERE key = 'contact_email';
  $q$,
  'S-099: service role can update contact group row'
);

-- 4. Admin (authenticated user with settings.site permission only) attempts to update
--    a contact-group row via RLS; should be blocked by the group-check trigger.
--    We switch to 'authenticated' role and set the JWT claim to the admin user.
DO $$
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'sub',  '99100000-0000-0000-0000-000000000002',
      'role', 'authenticated'
    )::text,
    true
  );
END;
$$;

SELECT throws_ok(
  $q$
    UPDATE public.site_settings
       SET value = '"hacked@evil.com"'::jsonb
     WHERE key = 'contact_email';
  $q$,
  'S-099: Admin cannot update contact-group row (trigger or RLS refuses)'
);

-- 5. Admin CAN update a site-group row (settings.site permission)
SELECT lives_ok(
  $q$
    UPDATE public.site_settings
       SET value = '"CeylonSafety Test"'::jsonb
     WHERE key = 'footer_business_name';
  $q$,
  'S-099: Admin can update site-group row'
);

-- Reset to service role for cleanup
RESET ROLE;

-- 6. Anon cannot read a private (is_public=false) setting
DO $$
BEGIN
  SET LOCAL ROLE anon;
END;
$$;

SELECT is(
  (SELECT count(*)::int FROM public.site_settings WHERE key = 'bank_account_details' AND is_public = false),
  0,
  'S-099: anon cannot read is_public=false settings'
);

RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
