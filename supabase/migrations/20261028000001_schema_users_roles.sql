-- S-011: Schema 1 — profiles, user_roles, role_permissions, triggers, RLS
-- Infrastructure only; no user-visible change.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. private schema
-- ─────────────────────────────────────────────────────────────────────────────

CREATE SCHEMA IF NOT EXISTS private;

-- The API (PostgREST) does not expose the private schema.
-- Revoke usage from PUBLIC so anon/authenticated have no path in at all.
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO postgres, service_role;

-- Every FUTURE function created in private is denied to PUBLIC (incl. anon / authenticated)
-- by default. This is the mechanism tested in AC1.
ALTER DEFAULT PRIVILEGES IN SCHEMA private
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. set_updated_at — shared utility trigger for all tables with updated_at
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Trigger functions are called by the database engine, not by users,
-- but revoke from roles anyway for defence in depth.
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.set_updated_at() TO postgres, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. private.normalize_for_staff_check — NFKC + look-alike substitution
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION private.normalize_for_staff_check(p_text text)
  RETURNS text
  LANGUAGE plpgsql
  IMMUTABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v text;
BEGIN
  IF p_text IS NULL THEN
    RETURN '';
  END IF;

  -- NFKC normalization (PostgreSQL 13+, available in Supabase's PostgreSQL 15)
  v := normalize(p_text, NFKC);

  -- Lower-case
  v := lower(v);

  -- Remove zero-width and invisible characters
  v := regexp_replace(v, '[​-‍﻿­͏ᅟᅠ឴឵ㅤﾠ]', '', 'g');

  -- Greek uppercase look-alikes → ASCII
  v := replace(v, chr(913), 'a');  -- Α
  v := replace(v, chr(914), 'b');  -- Β
  v := replace(v, chr(917), 'e');  -- Ε
  v := replace(v, chr(918), 'z');  -- Ζ
  v := replace(v, chr(919), 'h');  -- Η
  v := replace(v, chr(921), 'i');  -- Ι
  v := replace(v, chr(922), 'k');  -- Κ
  v := replace(v, chr(924), 'm');  -- Μ
  v := replace(v, chr(925), 'n');  -- Ν
  v := replace(v, chr(927), 'o');  -- Ο
  v := replace(v, chr(929), 'r');  -- Ρ
  v := replace(v, chr(932), 't');  -- Τ
  v := replace(v, chr(933), 'u');  -- Υ
  v := replace(v, chr(935), 'x');  -- Χ

  -- Greek lowercase look-alikes → ASCII
  v := replace(v, chr(945), 'a');  -- α
  v := replace(v, chr(946), 'b');  -- β
  v := replace(v, chr(949), 'e');  -- ε
  v := replace(v, chr(950), 'z');  -- ζ
  v := replace(v, chr(951), 'h');  -- η
  v := replace(v, chr(953), 'i');  -- ι
  v := replace(v, chr(954), 'k');  -- κ
  v := replace(v, chr(956), 'm');  -- μ
  v := replace(v, chr(957), 'n');  -- ν
  v := replace(v, chr(959), 'o');  -- ο
  v := replace(v, chr(961), 'r');  -- ρ
  v := replace(v, chr(964), 't');  -- τ
  v := replace(v, chr(965), 'u');  -- υ
  v := replace(v, chr(967), 'x');  -- χ

  -- Cyrillic look-alikes → ASCII
  v := replace(v, chr(1072), 'a');  -- а
  v := replace(v, chr(1074), 'b');  -- в (approximate)
  v := replace(v, chr(1077), 'e');  -- е
  v := replace(v, chr(1086), 'o');  -- о
  v := replace(v, chr(1088), 'r');  -- р
  v := replace(v, chr(1089), 'c');  -- с
  v := replace(v, chr(1090), 't');  -- т (approximate)
  v := replace(v, chr(1091), 'u');  -- у
  v := replace(v, chr(1093), 'x');  -- х
  v := replace(v, chr(1080), 'n');  -- й (approximate, looks like u sometimes)
  v := replace(v, chr(1085), 'n');  -- н
  v := replace(v, chr(1084), 'm');  -- м

  -- Common digit/symbol substitutions
  v := replace(v, '0', 'o');
  v := replace(v, '1', 'i');
  v := replace(v, '3', 'e');
  v := replace(v, '@', 'a');
  v := replace(v, '$', 's');
  v := replace(v, '5', 's');

  -- Trim and collapse whitespace
  v := trim(regexp_replace(v, '\s+', ' ', 'g'));

  RETURN v;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. private.is_staff_like_name
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION private.is_staff_like_name(p_name text)
  RETURNS boolean
  LANGUAGE plpgsql
  IMMUTABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v text;
BEGIN
  v := private.normalize_for_staff_check(p_name);

  -- Word-boundary match on banned staff-like words (Tcl RE: \m = word start, \M = word end)
  RETURN v ~ '\m(admin|support|moderator|ceylonsafety|ceylon safety|staff|maintainer|superadmin|super admin|operator|helpdesk|webmaster|root|sysadmin)\M';
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. profiles table
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profiles (
  id                    uuid          NOT NULL,
  first_name            text,
  last_name             text,
  display_name          text          NOT NULL,
  email                 text          NOT NULL,
  phone                 text,
  company_name          text,
  tax_id                text,
  billing_address       jsonb,
  avatar_url            text,
  locale                text          NOT NULL DEFAULT 'en',
  status                text          NOT NULL DEFAULT 'active',
  suspended_reason      text,
  -- terms_revision_id FK to page_revisions added in S-013 (page_revisions does not exist yet)
  terms_revision_id     uuid,
  terms_accepted_at     timestamptz,
  deleted_at            timestamptz,
  idle_warning_sent_at  timestamptz,
  created_at            timestamptz   NOT NULL DEFAULT now(),
  updated_at            timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT profiles_pkey
    PRIMARY KEY (id),

  -- Deliberately NO foreign key to auth.users (profile can outlive a deleted login, schema §3)
  CONSTRAINT profiles_email_key
    UNIQUE (email),

  CONSTRAINT profiles_status_check
    CHECK (status IN ('active', 'suspended')),

  CONSTRAINT profiles_display_name_length
    CHECK (char_length(display_name) BETWEEN 2 AND 40),

  CONSTRAINT profiles_first_name_length
    CHECK (first_name IS NULL OR (char_length(first_name) BETWEEN 1 AND 60)),

  CONSTRAINT profiles_last_name_length
    CHECK (last_name IS NULL OR (char_length(last_name) BETWEEN 1 AND 60)),

  CONSTRAINT profiles_phone_length
    CHECK (phone IS NULL OR char_length(phone) <= 30),

  CONSTRAINT profiles_company_name_length
    CHECK (company_name IS NULL OR char_length(company_name) <= 120)
);

-- Partial index: suspended accounts (admin queue)
CREATE INDEX IF NOT EXISTS profiles_status_suspended_idx
  ON public.profiles (status)
  WHERE status = 'suspended';

-- Partial index: idle-account job filter
CREATE INDEX IF NOT EXISTS profiles_idle_warning_sent_at_idx
  ON public.profiles (idle_warning_sent_at)
  WHERE idle_warning_sent_at IS NOT NULL;

COMMENT ON TABLE public.profiles IS 'One row per registered user; id matches auth.users.id.';
COMMENT ON COLUMN public.profiles.terms_revision_id
  IS 'FK to page_revisions added in S-013. Stored as plain uuid until then.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. user_roles table
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id    uuid          NOT NULL,
  role       text          NOT NULL,
  granted_by uuid,
  granted_at timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT user_roles_pkey
    PRIMARY KEY (user_id),

  CONSTRAINT user_roles_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles (id) ON DELETE CASCADE,

  CONSTRAINT user_roles_granted_by_fkey
    FOREIGN KEY (granted_by) REFERENCES public.profiles (id),

  CONSTRAINT user_roles_role_check
    CHECK (role IN ('super_admin', 'admin', 'maintainer'))
);

-- Index the FK column (Postgres does not create these automatically)
CREATE INDEX IF NOT EXISTS user_roles_granted_by_idx
  ON public.user_roles (granted_by);

COMMENT ON TABLE public.user_roles IS
  'Staff roles. Customers have no row. Written only by service_role or Super Admin (S-012 adds the trigger).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. role_permissions table
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role   text NOT NULL,
  action text NOT NULL,

  CONSTRAINT role_permissions_pkey
    PRIMARY KEY (role, action),

  CONSTRAINT role_permissions_role_check
    CHECK (role IN ('super_admin', 'admin', 'maintainer'))
);

COMMENT ON TABLE public.role_permissions IS
  'Which role may perform which action. Deny by default. Seed rows added in S-020.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. set_updated_at trigger on profiles
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. private.sanitise_profile — BEFORE INSERT OR UPDATE trigger on profiles
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION private.sanitise_profile()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_suffix text;
BEGIN
  -- Trim text fields
  NEW.first_name    := nullif(trim(NEW.first_name), '');
  NEW.last_name     := nullif(trim(NEW.last_name), '');
  NEW.display_name  := trim(NEW.display_name);
  NEW.phone         := nullif(trim(NEW.phone), '');
  NEW.company_name  := nullif(trim(NEW.company_name), '');
  NEW.tax_id        := nullif(trim(NEW.tax_id), '');

  -- Enforce length limits (truncate to max; the CHECK constraint then validates)
  NEW.first_name    := left(NEW.first_name, 60);
  NEW.last_name     := left(NEW.last_name, 60);
  NEW.display_name  := left(NEW.display_name, 40);
  NEW.phone         := left(NEW.phone, 30);
  NEW.company_name  := left(NEW.company_name, 120);

  -- Enforce minimum display_name length and staff-like name check
  IF NEW.display_name IS NULL
     OR char_length(NEW.display_name) < 2
     OR private.is_staff_like_name(NEW.display_name)
  THEN
    -- Member + 6-char hex suffix derived from the user id (stable across re-inserts)
    v_suffix := substr(md5(NEW.id::text), 1, 6);
    NEW.display_name := 'Member' || v_suffix;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_sanitise
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION private.sanitise_profile();

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. private.create_profile_for — the ONE place that builds a profile row
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION private.create_profile_for(
  p_user_id             uuid,
  p_email               text,
  p_raw_user_meta_data  jsonb  DEFAULT '{}'::jsonb,
  p_raw_app_meta_data   jsonb  DEFAULT '{}'::jsonb
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_provider       text;
  v_first_name     text;
  v_last_name      text;
  v_full_name      text;
  v_display_name   text;
  v_avatar_url     text;
  v_last_initial   text;
  v_meta           jsonb;
BEGIN
  v_meta     := coalesce(p_raw_user_meta_data, '{}'::jsonb);
  v_provider := coalesce(p_raw_app_meta_data->>'provider', 'email');

  -- Extract names: form fields first, then Google fields, then full_name split
  v_first_name := trim(coalesce(
    nullif(trim(v_meta->>'first_name'),   ''),
    nullif(trim(v_meta->>'given_name'),   ''),
    nullif(trim(split_part(coalesce(v_meta->>'full_name', ''), ' ', 1)), '')
  ));

  v_last_name := trim(coalesce(
    nullif(trim(v_meta->>'last_name'),    ''),
    nullif(trim(v_meta->>'family_name'),  ''),
    (CASE
       WHEN array_length(
              string_to_array(trim(coalesce(v_meta->>'full_name', '')), ' '), 1) > 1
       THEN nullif(trim(
              split_part(coalesce(v_meta->>'full_name', ''), ' ', 2)), '')
       ELSE NULL
     END)
  ));

  -- Trim to length limits before staff check
  v_first_name := left(v_first_name, 60);
  v_last_name  := left(v_last_name,  60);
  v_first_name := nullif(v_first_name, '');
  v_last_name  := nullif(v_last_name,  '');

  -- Build display_name: "First L." format
  IF v_first_name IS NOT NULL THEN
    IF v_last_name IS NOT NULL THEN
      v_last_initial := upper(left(v_last_name, 1));
      v_display_name := v_first_name || ' ' || v_last_initial || '.';
    ELSE
      v_display_name := v_first_name;
    END IF;
  END IF;

  -- Reset to Member if staff-like, too short, too long, or null
  IF v_display_name IS NULL
     OR char_length(trim(v_display_name)) < 2
     OR char_length(trim(v_display_name)) > 40
     OR private.is_staff_like_name(v_display_name)
  THEN
    v_display_name := 'Member' || substr(md5(p_user_id::text), 1, 6);
  END IF;

  -- Avatar: Google only (provider = 'google')
  IF v_provider = 'google' THEN
    v_avatar_url := nullif(trim(v_meta->>'avatar_url'), '');
  ELSE
    v_avatar_url := NULL;
  END IF;

  -- terms_revision_id: until S-013 adds page_revisions, always NULL
  -- (validation query will be added in S-013: check the id exists in page_revisions)

  INSERT INTO public.profiles (
    id,
    first_name,
    last_name,
    display_name,
    email,
    avatar_url
    -- terms_revision_id intentionally omitted (stays NULL per S-011 scope)
    -- terms_accepted_at intentionally omitted
  ) VALUES (
    p_user_id,
    v_first_name,
    v_last_name,
    v_display_name,
    p_email,
    v_avatar_url
  )
  ON CONFLICT (id) DO NOTHING;  -- idempotent: requireUser() may call this after the trigger

EXCEPTION WHEN OTHERS THEN
  -- Never let profile creation fail an auth operation.
  -- Log so the failure is visible in Supabase database logs.
  -- The server's requireUser() will retry creation on the next request.
  RAISE WARNING 'create_profile_for failed for user %: %', p_user_id, SQLERRM;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. handle_new_user — trigger on auth.users (AFTER INSERT)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION private.handle_new_user()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
BEGIN
  PERFORM private.create_profile_for(
    NEW.id,
    NEW.email,
    coalesce(NEW.raw_user_meta_data, '{}'::jsonb),
    coalesce(NEW.raw_app_meta_data,  '{}'::jsonb)
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER handle_new_user
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION private.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. sync_auth_email — keep profiles.email in sync with auth.users.email
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION private.sync_auth_email()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    -- This UPDATE raises a unique_violation if the new email already exists in profiles,
    -- which rolls back the auth.users UPDATE as well (same transaction), keeping the two
    -- tables in sync (EC5).
    UPDATE public.profiles
       SET email = NEW.email
     WHERE id = NEW.id;
  END IF;
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN RAISE;  -- re-raise to roll back auth.users UPDATE (EC5)
  WHEN OTHERS THEN
    -- Log unexpected errors before swallowing so they appear in Supabase database logs.
    RAISE WARNING 'sync_auth_email failed for user %: %', NEW.id, SQLERRM;
END;
$$;

CREATE OR REPLACE TRIGGER sync_auth_email
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION private.sync_auth_email();

-- ─────────────────────────────────────────────────────────────────────────────
-- 13. role_permissions write-guard trigger (service-role-only, partial)
-- Enhanced in S-012 when is_super_admin() exists.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION private.guard_role_permissions()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
BEGIN
  -- Allow only postgres (migration runner) and service_role.
  -- current_user is the session user; in Supabase, service_role calls arrive as 'service_role'.
  -- S-012 will also permit super_admin callers via is_super_admin().
  -- Use session_user (login identity) not current_user (role-switchable via SET ROLE).
  IF session_user NOT IN ('postgres', 'supabase_admin', 'service_role') THEN
    RAISE EXCEPTION 'role_permissions may only be written by the service role or a Super Admin';
  END IF;
  -- BEFORE DELETE: return OLD so the delete is not suppressed (RETURN NEW would return NULL for DELETE)
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER role_permissions_write_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.role_permissions
  FOR EACH ROW
  EXECUTE FUNCTION private.guard_role_permissions();

-- ─────────────────────────────────────────────────────────────────────────────
-- 14. Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable RLS on all three tables
ALTER TABLE public.profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- FORCE RLS so the postgres superuser is also subject to policies.
-- Without this, direct DB connections and future migrations running as postgres
-- bypass all policies and read every row unfiltered.
ALTER TABLE public.profiles         FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles       FORCE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions FORCE ROW LEVEL SECURITY;

-- profiles: signed-in customer can read their own row
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- profiles: customer can update own row (column-level grant below limits WHICH columns)
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING     (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- profiles: no INSERT or DELETE policy for anon / authenticated
-- (service_role bypasses RLS entirely)

-- user_roles: no policies for anon or authenticated (staff policies added in S-012)
-- role_permissions: no policies for anon or authenticated

-- ─────────────────────────────────────────────────────────────────────────────
-- 15. Column-level grants on profiles
-- Customers may only UPDATE the listed columns; all other writes go through
-- service_role which bypasses RLS and column grants alike.
-- ─────────────────────────────────────────────────────────────────────────────

-- Revoke broad UPDATE first, then grant only allowed columns
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT  UPDATE (
  first_name,
  last_name,
  display_name,
  phone,
  company_name,
  tax_id,
  billing_address,
  avatar_url,
  locale
) ON public.profiles TO authenticated;

-- Ensure SELECT is granted for the authenticated role
GRANT SELECT ON public.profiles TO authenticated;
-- user_roles and role_permissions: authenticated role has no SELECT grant
-- (Supabase's anon and authenticated roles have broad defaults via schema grant;
--  since RLS is enabled with no policy for those roles, they effectively see nothing,
--  but we also explicitly revoke SELECT to be defence-in-depth.)
REVOKE SELECT ON public.user_roles       FROM authenticated, anon;
REVOKE SELECT ON public.role_permissions FROM authenticated, anon;
