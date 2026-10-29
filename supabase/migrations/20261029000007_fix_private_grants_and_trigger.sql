-- Fix 1: Revoke EXECUTE on ALL private schema functions from anon and authenticated.
-- Supabase's ALTER DEFAULT PRIVILEGES grants EXECUTE to PUBLIC (which includes anon
-- and authenticated) on all functions created after that grant, even in the private
-- schema. The schema-level REVOKE ALL FROM PUBLIC in S-011 strips the implicit
-- PUBLIC privilege but does not remove explicit role grants that Supabase adds via
-- default privileges. Revoke them explicitly here.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA private FROM anon, authenticated;

-- Fix 2: public.create_profile_for(auth.users) uses p_user.app_metadata but the
-- actual column on auth.users is raw_app_meta_data. Replace the function here.
CREATE OR REPLACE FUNCTION public.create_profile_for(p_user auth.users)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_first       text;
  v_last        text;
  v_display     text;
  v_avatar      text;
  v_terms_rev   uuid;
  v_rev_exists  boolean;
  v_raw         jsonb;
BEGIN
  v_raw := p_user.raw_user_meta_data;

  v_first := LEFT(TRIM(COALESCE(
    v_raw->>'first_name',
    v_raw->>'given_name',
    split_part(COALESCE(v_raw->>'full_name',''), ' ', 1)
  )), 60);
  v_last := LEFT(TRIM(COALESCE(
    v_raw->>'last_name',
    v_raw->>'family_name',
    NULLIF(split_part(COALESCE(v_raw->>'full_name',''), ' ', 2),'')
  )), 60);

  IF v_first IS NOT NULL AND v_first <> '' THEN
    v_display := v_first;
    IF v_last IS NOT NULL AND v_last <> '' THEN
      v_display := v_display || ' ' || LEFT(v_last, 1) || '.';
    END IF;
  ELSE
    v_display := 'Member' || UPPER(LEFT(replace(gen_random_uuid()::text, '-', ''), 6));
  END IF;

  -- Use raw_app_meta_data (not app_metadata which does not exist as a column)
  IF p_user.raw_app_meta_data->>'provider' = 'google' THEN
    v_avatar := v_raw->>'avatar_url';
  END IF;

  BEGIN
    v_terms_rev := (v_raw->>'terms_revision_id')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    v_terms_rev := NULL;
  END;
  IF v_terms_rev IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.page_revisions WHERE id = v_terms_rev
    ) INTO v_rev_exists;
    IF NOT v_rev_exists THEN
      v_terms_rev := NULL;
    END IF;
  END IF;

  INSERT INTO public.profiles (
    id, first_name, last_name, display_name,
    email, avatar_url, terms_revision_id,
    terms_accepted_at
  ) VALUES (
    p_user.id,
    NULLIF(v_first, ''),
    NULLIF(v_last, ''),
    v_display,
    p_user.email,
    v_avatar,
    v_terms_rev,
    CASE WHEN v_terms_rev IS NOT NULL THEN now() ELSE NULL END
  )
  ON CONFLICT (id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.create_profile_for(auth.users) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_profile_for(auth.users) TO postgres, service_role;

-- Fix 3: Update private.handle_new_user to call public.create_profile_for(auth.users).
-- Migration 000003 (S-013) created public.create_profile_for(auth.users) which
-- validates terms_revision_id from raw_user_meta_data. The trigger was not updated
-- to call this new function, so terms_revision_id was always stored as NULL.
CREATE OR REPLACE FUNCTION private.handle_new_user()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
BEGIN
  PERFORM public.create_profile_for(NEW);
  RETURN NEW;
END;
$$;
