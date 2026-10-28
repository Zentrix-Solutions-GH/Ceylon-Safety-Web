-- S-012: pgTAP tests for permission functions, claims hook, Super Admin protection
-- Run with: supabase test db
-- Requires Docker + local Supabase stack.

BEGIN;
SELECT plan(41);

-- ─────────────────────────────────────────────────────────────────────────────
-- Fixtures
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_sa_id   uuid := '11111111-0000-0000-0000-000000000001'::uuid;
  v_admin   uuid := '11111111-0000-0000-0000-000000000002'::uuid;
  v_maint   uuid := '11111111-0000-0000-0000-000000000003'::uuid;
  v_cust    uuid := '11111111-0000-0000-0000-000000000004'::uuid;
  v_susp    uuid := '11111111-0000-0000-0000-000000000005'::uuid;
  v_sa2     uuid := '11111111-0000-0000-0000-000000000006'::uuid;
BEGIN
  INSERT INTO public.profiles (id, display_name, email, status) VALUES
    (v_sa_id, 'SuperAdmin One',  'sa1@test.com',    'active'),
    (v_admin, 'Admin One',       'admin@test.com',  'active'),
    (v_maint, 'Maintainer One',  'maint@test.com',  'active'),
    (v_cust,  'Customer One',    'cust@test.com',   'active'),
    (v_susp,  'Suspended One',   'susp@test.com',   'suspended'),
    (v_sa2,   'SuperAdmin Two',  'sa2@test.com',    'active');

  -- Staff roles (service role writes these; trigger allows it)
  INSERT INTO public.user_roles (user_id, role) VALUES
    (v_sa_id, 'super_admin'),
    (v_admin, 'admin'),
    (v_maint, 'maintainer'),
    (v_sa2,   'super_admin');

  -- Permission row for admin: articles.*
  INSERT INTO public.role_permissions (role, action) VALUES
    ('admin', 'articles.*');
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- AC1: public functions exist and are callable by anon / authenticated
-- ─────────────────────────────────────────────────────────────────────────────

SELECT has_function('public', 'is_staff_member', ARRAY[]::text[],
  'AC1: public.is_staff_member() exists');

SELECT has_function('public', 'is_super_admin', ARRAY[]::text[],
  'AC1: public.is_super_admin() exists');

SELECT has_function('public', 'has_permission', ARRAY['text'],
  'AC1: public.has_permission(text) exists');

-- anon can execute them
SET LOCAL role TO anon;
SELECT ok(
  (SELECT public.is_staff_member()) IS NOT NULL,
  'AC1: anon can call is_staff_member'
);
SELECT ok(
  (SELECT public.is_super_admin()) IS NOT NULL,
  'AC1: anon can call is_super_admin'
);
SELECT ok(
  (SELECT public.has_permission('articles.save')) IS NOT NULL,
  'AC1: anon can call has_permission'
);
RESET role;

-- ─────────────────────────────────────────────────────────────────────────────
-- AC2: has_permission matrix
-- ─────────────────────────────────────────────────────────────────────────────

-- Admin with articles.* passes articles.save
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"11111111-0000-0000-0000-000000000002","role":"authenticated"}';

SELECT is(
  (SELECT public.has_permission('articles.save')),
  true,
  'AC2: admin with articles.* passes articles.save'
);

-- Admin fails articles (no dot → not a sub-action, no exact match for "articles")
SELECT is(
  (SELECT public.has_permission('articles')),
  false,
  'AC2: admin fails articles (bare area name, no dot)'
);

-- Admin fails videos.add (different area)
SELECT is(
  (SELECT public.has_permission('videos.add')),
  false,
  'AC2: admin fails videos.add (no videos.* row)'
);

-- Admin fails articlesx.save (different area prefix)
SELECT is(
  (SELECT public.has_permission('articlesx.save')),
  false,
  'AC2: admin fails articlesx.save (prefix mismatch)'
);
RESET role;

-- Maintainer with no rows fails everything
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"11111111-0000-0000-0000-000000000003","role":"authenticated"}';

SELECT is(
  (SELECT public.has_permission('articles.save')),
  false,
  'AC2: maintainer with no permission rows fails everything'
);
RESET role;

-- Customer (no user_roles row) fails
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"11111111-0000-0000-0000-000000000004","role":"authenticated"}';

SELECT is(
  (SELECT public.has_permission('articles.save')),
  false,
  'AC2: customer fails has_permission'
);
RESET role;

-- No session (auth.uid() = null): returns false, not an error (EC6)
SET LOCAL role TO anon;
SELECT is(
  (SELECT public.has_permission('articles.save')),
  false,
  'EC6: anon (no session) returns false, not an error'
);
SELECT is(
  (SELECT public.is_staff_member()),
  false,
  'EC6: anon is_staff_member returns false'
);
SELECT is(
  (SELECT public.is_super_admin()),
  false,
  'EC6: anon is_super_admin returns false'
);
RESET role;

-- AC2: Super Admin passes has_permission regardless of permission rows
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"11111111-0000-0000-0000-000000000001","role":"authenticated"}';
SELECT is(
  (SELECT public.has_permission('articles.save')),
  true,
  'AC2: super_admin passes has_permission (no rows needed)'
);
RESET role;

-- EC3: has_permission(NULL) returns false
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"11111111-0000-0000-0000-000000000002","role":"authenticated"}';
SELECT is(
  (SELECT public.has_permission(NULL::text)),
  false,
  'EC3: has_permission(NULL) returns false'
);
-- EC3: has_permission('') returns false
SELECT is(
  (SELECT public.has_permission('')),
  false,
  'EC3: has_permission empty string returns false'
);
RESET role;

-- EC2: user whose role was deleted still gets false (reads DB, not token)
DO $$
DECLARE
  v_ex_staff uuid := '11111111-0000-0000-0000-000000000099'::uuid;
BEGIN
  INSERT INTO public.profiles (id, display_name, email) VALUES
    (v_ex_staff, 'ExStaff', 'exstaff@test.com');
  INSERT INTO public.user_roles (user_id, role) VALUES (v_ex_staff, 'admin');
  INSERT INTO public.role_permissions (role, action) VALUES ('admin', 'videos.*')
    ON CONFLICT DO NOTHING;
  DELETE FROM public.user_roles WHERE user_id = v_ex_staff;
END;
$$;

SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"11111111-0000-0000-0000-000000000099","role":"authenticated"}';
SELECT is(
  (SELECT public.has_permission('articles.save')),
  false,
  'EC2: has_permission reads DB; returns false after role deleted'
);
RESET role;

-- ─────────────────────────────────────────────────────────────────────────────
-- AC3: Staff RLS policies
-- ─────────────────────────────────────────────────────────────────────────────

-- Admin can read non-SA rows in user_roles
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"11111111-0000-0000-0000-000000000002","role":"authenticated"}';
SELECT ok(
  (SELECT count(*)::int FROM public.user_roles
    WHERE user_id = '11111111-0000-0000-0000-000000000003') = 1,
  'AC3: admin can read maintainer user_roles row'
);

-- Admin CANNOT see super_admin rows
SELECT is(
  (SELECT count(*)::int FROM public.user_roles WHERE role = 'super_admin'),
  0,
  'AC3: admin cannot see super_admin rows in user_roles'
);
RESET role;

-- Super Admin CAN see super_admin rows
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"11111111-0000-0000-0000-000000000001","role":"authenticated"}';
SELECT ok(
  (SELECT count(*)::int FROM public.user_roles WHERE role = 'super_admin') >= 1,
  'AC3: super_admin can see super_admin rows'
);
RESET role;

-- Admin can read role_permissions
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"11111111-0000-0000-0000-000000000002","role":"authenticated"}';
SELECT ok(
  (SELECT count(*)::int FROM public.role_permissions) >= 1,
  'AC3: admin can read role_permissions'
);
RESET role;

-- Admin can read non-SA profile
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"11111111-0000-0000-0000-000000000002","role":"authenticated"}';
SELECT is(
  (SELECT count(*)::int FROM public.profiles
    WHERE id = '11111111-0000-0000-0000-000000000003'),
  1,
  'AC3: admin can read maintainer profile'
);

-- Admin CANNOT read super_admin profile
SELECT is(
  (SELECT count(*)::int FROM public.profiles
    WHERE id = '11111111-0000-0000-0000-000000000001'),
  0,
  'AC3: admin cannot read super_admin profile'
);
RESET role;

-- Super Admin CAN read super_admin profile
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"11111111-0000-0000-0000-000000000001","role":"authenticated"}';
SELECT is(
  (SELECT count(*)::int FROM public.profiles
    WHERE id = '11111111-0000-0000-0000-000000000001'),
  1,
  'AC3: super_admin can read own super_admin profile'
);
RESET role;

-- Customer cannot read user_roles
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"11111111-0000-0000-0000-000000000004","role":"authenticated"}';
SELECT is(
  (SELECT count(*)::int FROM public.user_roles),
  0,
  'AC3: customer cannot read user_roles'
);

-- Customer cannot read role_permissions
SELECT is(
  (SELECT count(*)::int FROM public.role_permissions),
  0,
  'AC3: customer cannot read role_permissions'
);
RESET role;

-- ─────────────────────────────────────────────────────────────────────────────
-- AC4: role_permissions write guard — admin cannot write
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  SET LOCAL role TO authenticated;
  SET LOCAL request.jwt.claims TO '{"sub":"11111111-0000-0000-0000-000000000002","role":"authenticated"}';
  BEGIN
    INSERT INTO public.role_permissions (role, action) VALUES ('admin', 'articles.evil');
    ASSERT false, 'AC4: admin must not insert into role_permissions';
  EXCEPTION
    WHEN assert_failure THEN RAISE;
    WHEN OTHERS THEN NULL;
  END;
END;
$$;
RESET role;
SELECT pass('AC4: admin cannot write role_permissions (trigger + policy blocks insert)');

-- ─────────────────────────────────────────────────────────────────────────────
-- AC5: Super Admin protection trigger on user_roles
-- ─────────────────────────────────────────────────────────────────────────────

-- Authenticated (non-SA) cannot insert a super_admin row (AC7 test also)
DO $$
BEGIN
  SET LOCAL role TO authenticated;
  SET LOCAL request.jwt.claims TO '{"sub":"11111111-0000-0000-0000-000000000004","role":"authenticated"}';
  BEGIN
    INSERT INTO public.user_roles (user_id, role)
      VALUES ('11111111-0000-0000-0000-000000000004'::uuid, 'super_admin');
    ASSERT false, 'AC5/AC7: authenticated must not insert super_admin row';
  EXCEPTION
    WHEN assert_failure THEN RAISE;
    WHEN OTHERS THEN NULL;
  END;
END;
$$;
RESET role;
SELECT pass('AC5/AC7: authenticated cannot insert super_admin row into user_roles');

-- Admin cannot delete a super_admin row (EC4: admin cannot act on SA)
DO $$
DECLARE v_deleted int;
BEGIN
  SET LOCAL role TO authenticated;
  SET LOCAL request.jwt.claims TO '{"sub":"11111111-0000-0000-0000-000000000002","role":"authenticated"}';
  BEGIN
    -- RLS hides SA rows from admin, so DELETE affects 0 rows (no error).
    -- If somehow the trigger fires, it raises an exception (also caught here).
    DELETE FROM public.user_roles
     WHERE user_id = '11111111-0000-0000-0000-000000000001';
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    ASSERT v_deleted = 0, 'AC5/EC4: admin delete of SA row must affect 0 rows';
  EXCEPTION
    WHEN assert_failure THEN RAISE;
    WHEN OTHERS THEN NULL; -- trigger-raised exception is also acceptable
  END;
END;
$$;
RESET role;
SELECT pass('AC5/EC4: admin cannot delete super_admin row (blocked by trigger/RLS)');

-- Last Super Admin cannot be removed (EC1 single-transaction test)
DO $$
DECLARE
  v_sa_id uuid := '11111111-0000-0000-0000-000000000001'::uuid;
  v_sa2   uuid := '11111111-0000-0000-0000-000000000006'::uuid;
BEGIN
  -- Remove second SA first (count drops to 1)
  DELETE FROM public.user_roles WHERE user_id = v_sa2;
  -- Now try to remove the last SA
  BEGIN
    DELETE FROM public.user_roles WHERE user_id = v_sa_id;
    ASSERT false, 'EC1: must refuse to remove the last Super Admin';
  EXCEPTION
    WHEN assert_failure THEN RAISE;
    WHEN OTHERS THEN NULL;
  END;
  -- Restore the second SA for further tests
  INSERT INTO public.user_roles (user_id, role) VALUES (v_sa2, 'super_admin');
END;
$$;
SELECT pass('EC1: cannot remove the last Super Admin');

-- EC4: Admin cannot update super_admin profile (e.g., suspend via UPDATE)
DO $$
BEGIN
  SET LOCAL role TO authenticated;
  SET LOCAL request.jwt.claims TO '{"sub":"11111111-0000-0000-0000-000000000002","role":"authenticated"}';
  BEGIN
    UPDATE public.profiles
       SET status = 'suspended'
     WHERE id = '11111111-0000-0000-0000-000000000001';
    -- RLS hides the SA profile from admin, so UPDATE affects 0 rows without error
    -- The trigger also blocks it if somehow reached — both outcomes are acceptable
  END;
END;
$$;
RESET role;

-- Verify the SA profile was not actually changed
SELECT is(
  (SELECT status FROM public.profiles WHERE id = '11111111-0000-0000-0000-000000000001'),
  'active',
  'EC4: super_admin profile status unchanged after admin attempted suspend'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- AC5 / EC5: user_id is PK; second role insert for same user fails
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  BEGIN
    INSERT INTO public.user_roles (user_id, role)
      VALUES ('11111111-0000-0000-0000-000000000003'::uuid, 'admin');
    ASSERT false, 'EC5: duplicate user_id in user_roles must fail';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
END;
$$;
SELECT pass('EC5: same user cannot have a second role (PK constraint)');

-- ─────────────────────────────────────────────────────────────────────────────
-- AC6: custom_access_token_hook
-- ─────────────────────────────────────────────────────────────────────────────

-- super_admin gets user_role=super_admin and account_status=active
DO $$
DECLARE
  v_event  jsonb;
  v_result jsonb;
BEGIN
  v_event := jsonb_build_object(
    'user_id', '11111111-0000-0000-0000-000000000001',
    'claims',  '{}'::jsonb
  );
  v_result := private.custom_access_token_hook(v_event);
  ASSERT v_result->'claims'->>'user_role'      = 'super_admin',
    format('AC6: expected super_admin, got %s', v_result->'claims'->>'user_role');
  ASSERT v_result->'claims'->>'account_status' = 'active',
    format('AC6: expected active, got %s', v_result->'claims'->>'account_status');
END;
$$;
SELECT pass('AC6: super_admin hook returns user_role=super_admin, account_status=active');

-- admin gets user_role=admin
DO $$
DECLARE
  v_event  jsonb;
  v_result jsonb;
BEGIN
  v_event := jsonb_build_object(
    'user_id', '11111111-0000-0000-0000-000000000002',
    'claims',  '{}'::jsonb
  );
  v_result := private.custom_access_token_hook(v_event);
  ASSERT v_result->'claims'->>'user_role' = 'admin',
    format('AC6: expected admin, got %s', v_result->'claims'->>'user_role');
END;
$$;
SELECT pass('AC6: admin hook returns user_role=admin');

-- maintainer gets user_role=maintainer
DO $$
DECLARE
  v_event  jsonb;
  v_result jsonb;
BEGIN
  v_event := jsonb_build_object(
    'user_id', '11111111-0000-0000-0000-000000000003',
    'claims',  '{}'::jsonb
  );
  v_result := private.custom_access_token_hook(v_event);
  ASSERT v_result->'claims'->>'user_role' = 'maintainer',
    format('AC6: expected maintainer, got %s', v_result->'claims'->>'user_role');
END;
$$;
SELECT pass('AC6: maintainer hook returns user_role=maintainer');

-- customer gets no user_role claim, but account_status=active
DO $$
DECLARE
  v_event  jsonb;
  v_result jsonb;
BEGIN
  v_event := jsonb_build_object(
    'user_id', '11111111-0000-0000-0000-000000000004',
    'claims',  '{}'::jsonb
  );
  v_result := private.custom_access_token_hook(v_event);
  ASSERT (v_result->'claims'->'user_role') IS NULL,
    'AC6: customer must have no user_role claim';
  ASSERT v_result->'claims'->>'account_status' = 'active',
    'AC6: customer must have account_status=active';
END;
$$;
SELECT pass('AC6: customer hook has no user_role, account_status=active');

-- suspended customer gets account_status=suspended
DO $$
DECLARE
  v_event  jsonb;
  v_result jsonb;
BEGIN
  v_event := jsonb_build_object(
    'user_id', '11111111-0000-0000-0000-000000000005',
    'claims',  '{}'::jsonb
  );
  v_result := private.custom_access_token_hook(v_event);
  ASSERT v_result->'claims'->>'account_status' = 'suspended',
    format('AC6: expected suspended, got %s', v_result->'claims'->>'account_status');
END;
$$;
SELECT pass('AC6: suspended user hook returns account_status=suspended');

-- Hook never raises: unknown user_id returns event unmodified
DO $$
DECLARE
  v_event  jsonb;
  v_result jsonb;
BEGIN
  v_event := jsonb_build_object(
    'user_id', 'aaaaaaaa-0000-0000-0000-000000000000',
    'claims',  '{"existing":"value"}'::jsonb
  );
  v_result := private.custom_access_token_hook(v_event);
  -- Must return without error; claims may be unchanged or partial
  ASSERT v_result IS NOT NULL, 'AC6: hook must not fail on unknown user';
END;
$$;
SELECT pass('AC6: hook does not raise on unknown user_id');

-- ─────────────────────────────────────────────────────────────────────────────
-- AC7: authenticated cannot insert into user_roles (no INSERT policy)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  SET LOCAL role TO authenticated;
  SET LOCAL request.jwt.claims TO '{"sub":"11111111-0000-0000-0000-000000000004","role":"authenticated"}';
  BEGIN
    INSERT INTO public.user_roles (user_id, role)
      VALUES ('11111111-0000-0000-0000-000000000004'::uuid, 'admin');
    ASSERT false, 'AC7: authenticated insert into user_roles must fail';
  EXCEPTION
    WHEN assert_failure THEN RAISE;
    WHEN OTHERS THEN NULL;
  END;
END;
$$;
RESET role;
SELECT pass('AC7: no sign-up path produces a staff role (INSERT blocked for authenticated)');

SELECT * FROM finish();
ROLLBACK;
