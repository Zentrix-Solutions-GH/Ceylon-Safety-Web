-- S-011: pgTAP tests for profiles, user_roles, role_permissions, triggers and RLS
-- Run with: supabase test db
-- Requires Docker + local Supabase stack.

BEGIN;
SELECT plan(59);

-- ─────────────────────────────────────────────────────────────────────────────
-- AC1: private schema — functions not callable by anon / authenticated
-- ─────────────────────────────────────────────────────────────────────────────

SELECT has_schema('private', 'private schema exists');

-- Every function in private must deny EXECUTE to public, anon and authenticated
DO $$
DECLARE
  r record;
  has_public boolean;
  has_anon boolean;
  has_auth boolean;
BEGIN
  FOR r IN
    SELECT p.proname, n.nspname,
           pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'private'
  LOOP
    -- Include argument types in signature to avoid ambiguity on future overloads
    SELECT has_function_privilege('anon',
             format('%s.%s(%s)', r.nspname, r.proname, r.args), 'EXECUTE')
      INTO has_anon;
    ASSERT NOT has_anon,
      format('Function private.%s must not be executable by anon', r.proname);

    SELECT has_function_privilege('authenticated',
             format('%s.%s(%s)', r.nspname, r.proname, r.args), 'EXECUTE')
      INTO has_auth;
    ASSERT NOT has_auth,
      format('Function private.%s must not be executable by authenticated', r.proname);
  END LOOP;
END;
$$;

SELECT pass('AC1: private schema functions not callable by anon or authenticated');

-- ─────────────────────────────────────────────────────────────────────────────
-- AC2: set_updated_at trigger on profiles
-- ─────────────────────────────────────────────────────────────────────────────

SELECT has_trigger('public', 'profiles', 'profiles_set_updated_at',
  'AC2: profiles has set_updated_at trigger');

SELECT trigger_is('public', 'profiles', 'profiles_set_updated_at',
  'public', 'set_updated_at',
  'AC2: trigger calls set_updated_at function');

-- Behaviour test: updated_at changes on UPDATE
DO $$
DECLARE
  v_id uuid := gen_random_uuid();
  v_created timestamptz;
  v_updated_before timestamptz;
  v_updated_after timestamptz;
BEGIN
  -- Insert as service role (bypasses RLS)
  INSERT INTO public.profiles (id, display_name, email)
  VALUES (v_id, 'Test User', 'ac2test@example.com');

  SELECT created_at, updated_at INTO v_created, v_updated_before
    FROM public.profiles WHERE id = v_id;

  PERFORM pg_sleep(0.01);

  UPDATE public.profiles SET first_name = 'Updated' WHERE id = v_id;

  SELECT updated_at INTO v_updated_after FROM public.profiles WHERE id = v_id;

  ASSERT v_updated_after > v_updated_before,
    'AC2: updated_at should increase after an update';
  ASSERT v_updated_after >= v_created,
    'AC2: updated_at should be >= created_at';

  DELETE FROM public.profiles WHERE id = v_id;
END;
$$;

SELECT pass('AC2: updated_at changes on UPDATE');

-- ─────────────────────────────────────────────────────────────────────────────
-- AC3: profiles columns, CHECKs, indexes
-- ─────────────────────────────────────────────────────────────────────────────

SELECT has_table('public', 'profiles', 'AC3: profiles table exists');

SELECT has_column('public', 'profiles', 'id',                 'AC3: profiles.id');
SELECT has_column('public', 'profiles', 'first_name',         'AC3: profiles.first_name');
SELECT has_column('public', 'profiles', 'last_name',          'AC3: profiles.last_name');
SELECT has_column('public', 'profiles', 'display_name',       'AC3: profiles.display_name');
SELECT has_column('public', 'profiles', 'email',              'AC3: profiles.email');
SELECT has_column('public', 'profiles', 'phone',              'AC3: profiles.phone');
SELECT has_column('public', 'profiles', 'company_name',       'AC3: profiles.company_name');
SELECT has_column('public', 'profiles', 'tax_id',             'AC3: profiles.tax_id');
SELECT has_column('public', 'profiles', 'billing_address',    'AC3: profiles.billing_address');
SELECT has_column('public', 'profiles', 'avatar_url',         'AC3: profiles.avatar_url');
SELECT has_column('public', 'profiles', 'locale',             'AC3: profiles.locale');
SELECT has_column('public', 'profiles', 'status',             'AC3: profiles.status');
SELECT has_column('public', 'profiles', 'suspended_reason',   'AC3: profiles.suspended_reason');
SELECT has_column('public', 'profiles', 'terms_revision_id',  'AC3: profiles.terms_revision_id');
SELECT has_column('public', 'profiles', 'terms_accepted_at',  'AC3: profiles.terms_accepted_at');
SELECT has_column('public', 'profiles', 'deleted_at',         'AC3: profiles.deleted_at');
SELECT has_column('public', 'profiles', 'idle_warning_sent_at','AC3: profiles.idle_warning_sent_at');
SELECT has_column('public', 'profiles', 'created_at',         'AC3: profiles.created_at');
SELECT has_column('public', 'profiles', 'updated_at',         'AC3: profiles.updated_at');

-- No FK to auth.users
SELECT hasnt_fk('public', 'profiles', ARRAY['id'],
  'AC3: profiles.id has NO foreign key to auth.users');

-- Unique index on email
SELECT has_index('public', 'profiles', 'profiles_email_key',
  'AC3: unique index on email exists');

-- Partial indexes
SELECT has_index('public', 'profiles', 'profiles_status_suspended_idx',
  'AC3: partial index on status WHERE suspended');
SELECT has_index('public', 'profiles', 'profiles_idle_warning_sent_at_idx',
  'AC3: partial index on idle_warning_sent_at');

-- CHECK constraints
DO $$
DECLARE v_id uuid := gen_random_uuid();
BEGIN
  -- display_name too short
  BEGIN
    INSERT INTO public.profiles (id, display_name, email) VALUES (v_id, 'A', 'chk1@example.com');
    ASSERT false, 'AC3: display_name < 2 should be rejected';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  -- display_name too long
  BEGIN
    INSERT INTO public.profiles (id, display_name, email)
    VALUES (v_id, repeat('A', 41), 'chk2@example.com');
    ASSERT false, 'AC3: display_name > 40 should be rejected';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  -- first_name too long
  BEGIN
    INSERT INTO public.profiles (id, display_name, email, first_name)
    VALUES (v_id, 'OK Name', 'chk3@example.com', repeat('A', 61));
    ASSERT false, 'AC3: first_name > 60 should be rejected';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  -- phone too long
  BEGIN
    INSERT INTO public.profiles (id, display_name, email, phone)
    VALUES (v_id, 'OK Name', 'chk4@example.com', repeat('1', 31));
    ASSERT false, 'AC3: phone > 30 should be rejected';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  -- company_name too long
  BEGIN
    INSERT INTO public.profiles (id, display_name, email, company_name)
    VALUES (v_id, 'OK Name', 'chk5@example.com', repeat('A', 121));
    ASSERT false, 'AC3: company_name > 120 should be rejected';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  -- status invalid
  BEGIN
    INSERT INTO public.profiles (id, display_name, email, status)
    VALUES (v_id, 'OK Name', 'chk6@example.com', 'banned');
    ASSERT false, 'AC3: invalid status should be rejected';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END;
$$;

SELECT pass('AC3: profiles CHECKs enforced correctly');

-- ─────────────────────────────────────────────────────────────────────────────
-- AC4: user_roles and role_permissions columns and constraints
-- ─────────────────────────────────────────────────────────────────────────────

SELECT has_table('public', 'user_roles', 'AC4: user_roles table exists');
SELECT has_column('public', 'user_roles', 'user_id',    'AC4: user_roles.user_id');
SELECT has_column('public', 'user_roles', 'role',       'AC4: user_roles.role');
SELECT has_column('public', 'user_roles', 'granted_by', 'AC4: user_roles.granted_by');
SELECT has_column('public', 'user_roles', 'granted_at', 'AC4: user_roles.granted_at');

SELECT has_index('public', 'user_roles', 'user_roles_granted_by_idx',
  'AC4: FK index on user_roles.granted_by');

SELECT has_table('public', 'role_permissions', 'AC4: role_permissions table exists');
SELECT has_column('public', 'role_permissions', 'role',   'AC4: role_permissions.role');
SELECT has_column('public', 'role_permissions', 'action', 'AC4: role_permissions.action');

-- role CHECK on user_roles
DO $$
DECLARE v_id uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.profiles (id, display_name, email) VALUES (v_id, 'Role Test', 'roletest@example.com');
  BEGIN
    INSERT INTO public.user_roles (user_id, role) VALUES (v_id, 'owner');
    ASSERT false, 'AC4: invalid role in user_roles should be rejected';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  DELETE FROM public.profiles WHERE id = v_id;
END;
$$;

-- role CHECK on role_permissions
DO $$
BEGIN
  BEGIN
    INSERT INTO public.role_permissions (role, action) VALUES ('owner', 'articles.*');
    ASSERT false, 'AC4: invalid role in role_permissions should be rejected';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END;
$$;

SELECT pass('AC4: user_roles and role_permissions CHECKs enforced');

-- ─────────────────────────────────────────────────────────────────────────────
-- AC5 / AC6 / EC1–EC7: create_profile_for and handle_new_user
-- ─────────────────────────────────────────────────────────────────────────────

-- EC1: Google provides given_name/family_name (no first_name key)
DO $$
DECLARE
  v_id uuid := gen_random_uuid();
  v_display text;
  v_avatar text;
BEGIN
  PERFORM private.create_profile_for(
    v_id, 'ec1@example.com',
    '{"given_name":"Nimal","family_name":"Perera","avatar_url":"https://googleavatar.com/123"}'::jsonb,
    '{"provider":"google"}'::jsonb
  );
  SELECT display_name, avatar_url INTO v_display, v_avatar FROM public.profiles WHERE id = v_id;
  ASSERT v_display = 'Nimal P.', format('EC1: display_name should be "Nimal P." got "%s"', v_display);
  ASSERT v_avatar IS NOT NULL, 'EC1: avatar_url should be copied for Google';
  DELETE FROM public.profiles WHERE id = v_id;
END;
$$;
SELECT pass('EC1: Google given_name/family_name used for display_name');

-- EC2: Only email supplied — display_name must not contain part of email
DO $$
DECLARE
  v_id uuid := gen_random_uuid();
  v_display text;
BEGIN
  PERFORM private.create_profile_for(
    v_id, 'ec2user@example.com',
    '{}'::jsonb, '{"provider":"email"}'::jsonb
  );
  SELECT display_name INTO v_display FROM public.profiles WHERE id = v_id;
  ASSERT v_display LIKE 'Member%', format('EC2: no names should produce "Member..." got "%s"', v_display);
  ASSERT v_display NOT LIKE '%ec2%', 'EC2: display_name must not contain email parts';
  DELETE FROM public.profiles WHERE id = v_id;
END;
$$;
SELECT pass('EC2: no names produces Member+suffix, not email-derived');

-- EC3: Staff-like names reset to Member
DO $$
DECLARE
  v_id uuid := gen_random_uuid();
  v_display text;
BEGIN
  -- "Admin" via email sign-up
  PERFORM private.create_profile_for(
    v_id, 'ec3a@example.com',
    '{"first_name":"Admin"}'::jsonb, '{"provider":"email"}'::jsonb
  );
  SELECT display_name INTO v_display FROM public.profiles WHERE id = v_id;
  ASSERT v_display LIKE 'Member%', format('EC3a: Admin first_name should produce Member got "%s"', v_display);
  DELETE FROM public.profiles WHERE id = v_id;

  -- Greek look-alike "Αdmin" (Greek capital Alpha + dmin)
  PERFORM private.create_profile_for(
    v_id, 'ec3b@example.com',
    format('{"first_name":"%s"}', chr(913) || 'dmin')::jsonb,
    '{"provider":"email"}'::jsonb
  );
  SELECT display_name INTO v_display FROM public.profiles WHERE id = v_id;
  ASSERT v_display LIKE 'Member%',
    format('EC3b: Greek look-alike Admin should produce Member got "%s"', v_display);
  DELETE FROM public.profiles WHERE id = v_id;
END;
$$;
SELECT pass('EC3: staff-like names (including look-alikes) produce Member');

-- EC4: Two sign-ups with same "Nimal P." — both allowed (display_name not unique)
DO $$
DECLARE
  v_id1 uuid := gen_random_uuid();
  v_id2 uuid := gen_random_uuid();
  v_d1 text;
  v_d2 text;
BEGIN
  PERFORM private.create_profile_for(v_id1, 'ec4a@example.com',
    '{"first_name":"Nimal","last_name":"Perera"}'::jsonb, '{"provider":"email"}'::jsonb);
  PERFORM private.create_profile_for(v_id2, 'ec4b@example.com',
    '{"first_name":"Nimal","last_name":"Perera"}'::jsonb, '{"provider":"email"}'::jsonb);
  SELECT display_name INTO v_d1 FROM public.profiles WHERE id = v_id1;
  SELECT display_name INTO v_d2 FROM public.profiles WHERE id = v_id2;
  ASSERT v_d1 = v_d2, 'EC4: same display_name is allowed for two users';
  DELETE FROM public.profiles WHERE id IN (v_id1, v_id2);
END;
$$;
SELECT pass('EC4: duplicate display_name allowed');

-- EC6: Non-Google provider does NOT copy avatar
DO $$
DECLARE
  v_id uuid := gen_random_uuid();
  v_avatar text;
BEGIN
  PERFORM private.create_profile_for(
    v_id, 'ec6@example.com',
    '{"avatar_url":"https://otherprovider.com/avatar"}'::jsonb,
    '{"provider":"email"}'::jsonb
  );
  SELECT avatar_url INTO v_avatar FROM public.profiles WHERE id = v_id;
  ASSERT v_avatar IS NULL, 'EC6: non-Google avatar must not be copied';
  DELETE FROM public.profiles WHERE id = v_id;
END;
$$;
SELECT pass('EC6: non-Google avatar not copied');

-- EC7: terms_revision_id pointing to nothing — stored NULL, sign-up succeeds
DO $$
DECLARE
  v_id uuid := gen_random_uuid();
  v_terms uuid;
BEGIN
  PERFORM private.create_profile_for(
    v_id, 'ec7@example.com',
    format('{"terms_revision_id":"%s"}', gen_random_uuid())::jsonb,
    '{"provider":"email"}'::jsonb
  );
  SELECT terms_revision_id INTO v_terms FROM public.profiles WHERE id = v_id;
  ASSERT v_terms IS NULL,
    'EC7: nonexistent terms_revision_id should be stored as NULL';
  DELETE FROM public.profiles WHERE id = v_id;
END;
$$;
SELECT pass('EC7: nonexistent terms_revision_id stored as NULL');

-- Idempotency: calling create_profile_for twice for the same user does not error
DO $$
DECLARE v_id uuid := gen_random_uuid();
BEGIN
  PERFORM private.create_profile_for(v_id, 'idem@example.com',
    '{"first_name":"Idem"}'::jsonb, '{"provider":"email"}'::jsonb);
  PERFORM private.create_profile_for(v_id, 'idem@example.com',
    '{"first_name":"Idem"}'::jsonb, '{"provider":"email"}'::jsonb);
  DELETE FROM public.profiles WHERE id = v_id;
END;
$$;
SELECT pass('AC5/AC6: create_profile_for is idempotent (ON CONFLICT DO NOTHING)');

-- AC6: handle_new_user never errors on odd input
DO $$
DECLARE v_id uuid := gen_random_uuid();
BEGIN
  -- 1000-character name
  PERFORM private.create_profile_for(
    v_id, 'oddlong@example.com',
    format('{"first_name":"%s"}', repeat('A', 1000))::jsonb,
    '{"provider":"email"}'::jsonb
  );
  DELETE FROM public.profiles WHERE id = v_id;

  -- Emoji in name
  PERFORM private.create_profile_for(
    v_id, 'emoji@example.com',
    '{"first_name":"😀 User"}'::jsonb,
    '{"provider":"email"}'::jsonb
  );
  DELETE FROM public.profiles WHERE id = v_id;

  -- Null metadata
  PERFORM private.create_profile_for(
    v_id, 'nullmeta@example.com',
    NULL, NULL
  );
  DELETE FROM public.profiles WHERE id = v_id;
END;
$$;
SELECT pass('AC6: create_profile_for handles odd input without errors');

-- ─────────────────────────────────────────────────────────────────────────────
-- AC7: sanitising trigger on direct UPDATE
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_id uuid := gen_random_uuid();
  v_display text;
BEGIN
  INSERT INTO public.profiles (id, display_name, email)
  VALUES (v_id, 'Nimal P.', 'sanitise@example.com');

  -- Try to set display_name to "Admin"
  UPDATE public.profiles SET display_name = 'Admin' WHERE id = v_id;
  SELECT display_name INTO v_display FROM public.profiles WHERE id = v_id;
  ASSERT v_display LIKE 'Member%',
    format('AC7: direct update to "Admin" should produce Member, got "%s"', v_display);

  -- Try "Admin " (trailing space)
  UPDATE public.profiles SET display_name = 'Admin ' WHERE id = v_id;
  SELECT display_name INTO v_display FROM public.profiles WHERE id = v_id;
  ASSERT v_display LIKE 'Member%',
    format('AC7: direct update to "Admin " should produce Member, got "%s"', v_display);

  -- Try Greek look-alike
  UPDATE public.profiles SET display_name = chr(913) || 'dmin' WHERE id = v_id;
  SELECT display_name INTO v_display FROM public.profiles WHERE id = v_id;
  ASSERT v_display LIKE 'Member%',
    format('AC7: Greek look-alike Admin should produce Member, got "%s"', v_display);

  DELETE FROM public.profiles WHERE id = v_id;
END;
$$;
SELECT pass('AC7: sanitising trigger resets staff-like display names to Member');

-- ─────────────────────────────────────────────────────────────────────────────
-- AC8 / AC9: RLS tests
-- ─────────────────────────────────────────────────────────────────────────────

-- Setup: two customer profiles
DO $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email)
  VALUES
    ('00000000-0000-0000-0000-000000000001'::uuid, 'Customer A', 'custa@example.com'),
    ('00000000-0000-0000-0000-000000000002'::uuid, 'Customer B', 'custb@example.com');
END;
$$;

-- AC9: anon cannot read profiles
SET LOCAL role TO anon;
SELECT is(
  (SELECT count(*)::int FROM public.profiles),
  0,
  'AC9: anon cannot read any profiles row'
);
RESET role;

-- AC9: customer A cannot read customer B's profile
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
SELECT is(
  (SELECT count(*)::int FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000002'),
  0,
  'AC9: customer A cannot read customer B profile'
);

-- AC9: customer A can read their own profile
SELECT is(
  (SELECT count(*)::int FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000001'),
  1,
  'AC9: customer A can read own profile'
);

-- AC9: customer cannot update restricted columns on own row
DO $$
BEGIN
  SET LOCAL role TO authenticated;
  SET LOCAL request.jwt.claims TO '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';

  BEGIN
    UPDATE public.profiles SET status = 'suspended'
     WHERE id = '00000000-0000-0000-0000-000000000001';
    ASSERT false, 'AC9: customer must not update status';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    UPDATE public.profiles SET email = 'hacked@example.com'
     WHERE id = '00000000-0000-0000-0000-000000000001';
    ASSERT false, 'AC9: customer must not update email';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    UPDATE public.profiles SET deleted_at = now()
     WHERE id = '00000000-0000-0000-0000-000000000001';
    ASSERT false, 'AC9: customer must not update deleted_at';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    UPDATE public.profiles SET suspended_reason = 'self-suspend'
     WHERE id = '00000000-0000-0000-0000-000000000001';
    ASSERT false, 'AC9: customer must not update suspended_reason';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    UPDATE public.profiles SET terms_accepted_at = now()
     WHERE id = '00000000-0000-0000-0000-000000000001';
    ASSERT false, 'AC9: customer must not update terms_accepted_at';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$$;
RESET role;
SELECT pass('AC9: customer cannot update status, email, deleted_at, suspended_reason, terms_accepted_at');

-- AC9: anon cannot read user_roles
SET LOCAL role TO anon;
SELECT is(
  (SELECT count(*)::int FROM public.user_roles),
  0,
  'AC9: anon cannot read user_roles'
);
RESET role;

-- AC9: authenticated customer cannot read user_roles
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
SELECT is(
  (SELECT count(*)::int FROM public.user_roles),
  0,
  'AC9: authenticated customer cannot read user_roles'
);

-- AC9: customer cannot self-promote — cannot insert into user_roles
DO $$
BEGIN
  BEGIN
    INSERT INTO public.user_roles (user_id, role)
    VALUES ('00000000-0000-0000-0000-000000000001'::uuid, 'admin');
    ASSERT false, 'AC9: customer must not be able to self-promote via user_roles insert';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$$;
RESET role;
SELECT pass('AC9: customer cannot self-promote (insert into user_roles blocked)');

-- AC9: anon cannot read role_permissions
SET LOCAL role TO anon;
SELECT is(
  (SELECT count(*)::int FROM public.role_permissions),
  0,
  'AC9: anon cannot read role_permissions'
);
RESET role;

-- role_permissions write-guard: non-service-role cannot insert
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    INSERT INTO public.role_permissions (role, action) VALUES ('admin', 'articles.*');
    ASSERT false, 'role_permissions write-guard: non-service role should be blocked';
  EXCEPTION WHEN raise_exception THEN NULL;
  WHEN insufficient_privilege THEN NULL;
  END;
END;
$$;
RESET role;
SELECT pass('role_permissions write-guard blocks non-service-role writes');

-- Teardown RLS test fixtures
DELETE FROM public.profiles WHERE id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002'
);

-- EC5: sync_auth_email — duplicate email causes unique_violation and rolls back
-- NOTE: Full test requires DML on auth.users, which needs superuser access.
-- The partial test below is self-contained: it inserts a first row, then attempts
-- a duplicate email, verifying the UNIQUE constraint that sync_auth_email relies on.
DO $$
DECLARE
  v_id1 uuid := gen_random_uuid();
  v_id2 uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.profiles (id, display_name, email)
  VALUES (v_id1, 'EC5 First', 'ec5unique@example.com');

  BEGIN
    INSERT INTO public.profiles (id, display_name, email)
    VALUES (v_id2, 'EC5 Duplicate', 'ec5unique@example.com');
    ASSERT false, 'EC5: duplicate email in profiles must be rejected';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  DELETE FROM public.profiles WHERE id = v_id1;
END;
$$;
-- TODO(EC5-full): add a test that fires the sync_auth_email trigger via a direct
-- auth.users UPDATE once the test harness has superuser rights. Verify that a
-- conflicting email change rolls back the auth.users row AND leaves profiles unchanged.
SELECT pass('EC5: profiles.email unique constraint enforced (full trigger test requires superuser)');

SELECT * FROM finish();
ROLLBACK;
