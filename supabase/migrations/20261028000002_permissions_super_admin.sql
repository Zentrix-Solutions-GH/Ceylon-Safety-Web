-- S-012: Permission functions, claims hook, Super Admin protection
-- Infrastructure only; no user-visible change.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. public.is_staff_member()
--    True when the caller has any row in user_roles.
--    SECURITY DEFINER so RLS policies calling this do not recurse.
--    Policies call it as (SELECT public.is_staff_member()) to evaluate once per query.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_staff_member()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = (SELECT auth.uid())
  )
$$;

REVOKE ALL ON FUNCTION public.is_staff_member() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_staff_member() TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. public.is_super_admin()
--    True when the caller has a super_admin row in user_roles.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_super_admin()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = (SELECT auth.uid())
       AND role = 'super_admin'
  )
$$;

REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. public.has_permission(p_action text)
--    DENY BY DEFAULT: with an empty role_permissions table only the Super Admin passes.
--    NULL / empty action → false always (even for Super Admin).
--    Matching: exact (action = p_action) OR area wildcard (area.* row where p_action
--    starts with area.) — only when p_action contains a dot.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.has_permission(p_action text)
  RETURNS boolean
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_uid  uuid;
  v_role text;
  v_area text;
BEGIN
  -- NULL or empty input: always deny (EC3)
  IF p_action IS NULL OR p_action = '' THEN
    RETURN false;
  END IF;

  -- No session: always deny (EC6)
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  -- Look up the caller's role once
  SELECT role INTO v_role
    FROM public.user_roles
   WHERE user_id = v_uid;

  -- No role row → deny (also covers EC2: deleted role)
  IF v_role IS NULL THEN
    RETURN false;
  END IF;

  -- Super Admin always passes
  IF v_role = 'super_admin' THEN
    RETURN true;
  END IF;

  -- For dotted names, extract the area prefix for wildcard matching.
  -- Only the first segment is used: 'documents.files.upload' → area 'documents'.
  -- Multi-segment areas (e.g. 'documents.files.*') require an exact row; document
  -- any such action name in the S-020 seed migration before adding it.
  IF p_action LIKE '%.%' THEN
    v_area := split_part(p_action, '.', 1);
  END IF;

  -- Exact match or wildcard match (area.*)
  RETURN EXISTS (
    SELECT 1 FROM public.role_permissions
     WHERE role = v_role
       AND (
         action = p_action
         OR (v_area IS NOT NULL AND action = (v_area || '.*'))
       )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.has_permission(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_permission(text) TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Update private.guard_role_permissions to allow Super Admins
--    The S-011 version allowed only postgres / service_role.
--    S-012 adds: OR the caller is a Super Admin (public.is_super_admin()).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION private.guard_role_permissions()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
BEGIN
  -- current_user (not session_user): Supabase API calls arrive with session_user='authenticator'
  -- and SET ROLE service_role, so current_user is the reliable check here.
  IF current_user NOT IN ('postgres', 'supabase_admin', 'service_role')
    AND NOT public.is_super_admin()
  THEN
    RAISE EXCEPTION 'role_permissions may only be written by the service role or a Super Admin';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Grant SELECT on user_roles and role_permissions to authenticated
--    (S-011 revoked these as defence-in-depth while no policies existed.
--     RLS policies added below limit what each role actually sees.)
-- ─────────────────────────────────────────────────────────────────────────────

GRANT SELECT ON public.user_roles       TO authenticated;
GRANT SELECT ON public.role_permissions TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Staff RLS policies (AC3)
-- ─────────────────────────────────────────────────────────────────────────────

-- user_roles: staff can read, but super_admin rows are hidden from admin / maintainer
CREATE POLICY user_roles_select_staff ON public.user_roles
  FOR SELECT TO authenticated
  USING (
    (SELECT public.is_staff_member())
    AND (role <> 'super_admin' OR (SELECT public.is_super_admin()))
  );

-- role_permissions: all staff can read
CREATE POLICY role_permissions_select_staff ON public.role_permissions
  FOR SELECT TO authenticated
  USING ((SELECT public.is_staff_member()));

-- Helper: check if a profile belongs to a Super Admin, bypassing RLS.
-- Must be in public schema (not private) so that authenticated can call it
-- via the RLS policy on profiles. REVOKE ALL from PUBLIC, then GRANT only to
-- authenticated — anon cannot call it. SECURITY DEFINER bypasses user_roles RLS
-- so the check is always authoritative regardless of the caller's RLS view.
-- Non-staff callers always get false — this prevents the function from being
-- used as an RPC oracle to discover Super Admin UUIDs.
CREATE OR REPLACE FUNCTION public.profile_is_super_admin(p_profile_id uuid)
  RETURNS boolean
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
BEGIN
  -- Non-staff users must not be able to probe SA identity via RPC.
  IF NOT public.is_staff_member() THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = p_profile_id AND role = 'super_admin'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.profile_is_super_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_is_super_admin(uuid) TO authenticated;

-- profiles: staff can read all profiles, but Super Admin profiles are hidden from
-- non-Super-Admins (AC3). Uses public.profile_is_super_admin() to bypass the
-- user_roles RLS view (which hides super_admin rows from non-SA staff).
-- The existing profiles_select_own policy (S-011) still allows every authenticated
-- user to read their own row; this policy extends that for staff.
CREATE POLICY profiles_select_staff ON public.profiles
  FOR SELECT TO authenticated
  USING (
    (SELECT public.is_staff_member())
    AND NOT (
      (SELECT public.profile_is_super_admin(id))
      AND NOT (SELECT public.is_super_admin())
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Super Admin protection trigger on user_roles (AC5)
--    Rules:
--      INSERT a super_admin row: only service_role or an existing Super Admin.
--      UPDATE / DELETE a super_admin row: same restriction.
--      Removing the LAST super_admin is refused even by that Super Admin.
--    Concurrent last-SA delete safety: SELECT ... FOR UPDATE locks all SA rows
--    before the count, so two concurrent deletes serialize and the second sees
--    count = 1 and fails (EC1).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION private.guard_user_roles_super_admin()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_count int;
BEGIN
  -- INSERT: only service_role or Super Admin may create a super_admin row
  IF TG_OP = 'INSERT' AND NEW.role = 'super_admin' THEN
    IF current_user NOT IN ('postgres', 'supabase_admin', 'service_role')
      AND NOT public.is_super_admin()
    THEN
      RAISE EXCEPTION 'not_allowed: only the service role or a Super Admin may grant the super_admin role';
    END IF;
  END IF;

  -- UPDATE / DELETE on an existing super_admin row: same restriction
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.role = 'super_admin' THEN
    IF current_user NOT IN ('postgres', 'supabase_admin', 'service_role')
      AND NOT public.is_super_admin()
    THEN
      RAISE EXCEPTION 'not_allowed: only the service role or a Super Admin may change a super_admin row';
    END IF;
  END IF;

  -- Prevent removing the last Super Admin (EC1)
  -- Covers: DELETE of a super_admin row, or UPDATE that changes role away from super_admin
  IF (TG_OP = 'DELETE' AND OLD.role = 'super_admin') OR
     (TG_OP = 'UPDATE' AND OLD.role = 'super_admin' AND NEW.role <> 'super_admin')
  THEN
    -- Lock all super_admin rows to serialize concurrent deletes
    PERFORM 1 FROM public.user_roles WHERE role = 'super_admin' FOR UPDATE;
    SELECT count(*) INTO v_count FROM public.user_roles WHERE role = 'super_admin';
    IF v_count <= 1 THEN
      RAISE EXCEPTION 'not_allowed: cannot remove the last Super Admin';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER user_roles_guard_super_admin
  BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION private.guard_user_roles_super_admin();

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Super Admin protection trigger on profiles (AC5)
--    Before any UPDATE on a profile that belongs to a Super Admin, refuse
--    unless the caller is a Super Admin or the service role.
--    This blocks suspend, email-change and anonymise operations against the SA
--    even if someone calls the DB API directly.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION private.guard_profile_super_admin()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = OLD.id AND role = 'super_admin'
  ) THEN
    IF current_user NOT IN ('postgres', 'supabase_admin', 'service_role')
      AND NOT public.is_super_admin()
    THEN
      RAISE EXCEPTION 'not_allowed: cannot modify a Super Admin profile';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_guard_super_admin
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION private.guard_profile_super_admin();

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. private.custom_access_token_hook(event jsonb) (AC6)
--    Called by Supabase Auth before issuing a token.
--    Adds user_role (super_admin/admin/maintainer, or absent) and account_status
--    (active/suspended) to the JWT claims.
--    Never raises: on any error it logs a WARNING and returns the event unchanged.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION private.custom_access_token_hook(event jsonb)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_role    text;
  v_status  text;
  v_claims  jsonb;
BEGIN
  v_user_id := (event->>'user_id')::uuid;
  v_claims  := coalesce(event->'claims', '{}'::jsonb);

  -- Staff role (may be NULL for a customer)
  SELECT ur.role INTO v_role
    FROM public.user_roles ur
   WHERE ur.user_id = v_user_id;

  -- Account status (may be NULL if no profile row yet)
  SELECT p.status INTO v_status
    FROM public.profiles p
   WHERE p.id = v_user_id;

  -- Add user_role only for staff
  IF v_role IS NOT NULL THEN
    v_claims := jsonb_set(v_claims, '{user_role}', to_jsonb(v_role));
  END IF;

  -- Add account_status when a profile exists
  IF v_status IS NOT NULL THEN
    v_claims := jsonb_set(v_claims, '{account_status}', to_jsonb(v_status));
  END IF;

  RETURN jsonb_set(event, '{claims}', v_claims);

EXCEPTION WHEN OTHERS THEN
  -- Never fail a login; log so the failure is visible in database logs
  RAISE WARNING 'custom_access_token_hook error for user %: %', v_user_id, SQLERRM;
  RETURN event;
END;
$$;

-- Deny all other callers first; then grant only supabase_auth_admin.
-- The private schema already has REVOKE ALL ON SCHEMA private FROM PUBLIC (S-011),
-- but object-level EXECUTE is a separate privilege axis — an explicit REVOKE ensures
-- a future GRANT USAGE ON SCHEMA private to any role does not leak the hook.
REVOKE ALL ON FUNCTION private.custom_access_token_hook(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.custom_access_token_hook(jsonb)
  TO supabase_auth_admin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. AC8: Authenticator protection on auth.mfa_factors
--     Supabase hosted environments do not permit triggers on auth.* tables.
--     The guard therefore lives in the removeAuthenticator server action (S-039).
--     Evidence: attempted CREATE TRIGGER on auth.mfa_factors fails with
--     "must be owner of table mfa_factors" on the hosted Supabase stack.
--     The guard is noted as a server-code responsibility in S-039.
-- ─────────────────────────────────────────────────────────────────────────────

-- (No SQL — trigger on auth.mfa_factors not permitted; documented in story Evidence.)

-- ─────────────────────────────────────────────────────────────────────────────
-- Deny EXECUTE on all private functions to PUBLIC.
-- The S-011 schema-level REVOKE only covers functions that existed at that point;
-- functions created in this migration need their own explicit REVOKE.
-- ─────────────────────────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION private.guard_role_permissions()             FROM PUBLIC;
REVOKE ALL ON FUNCTION private.guard_user_roles_super_admin()       FROM PUBLIC;
REVOKE ALL ON FUNCTION private.guard_profile_super_admin()          FROM PUBLIC;
