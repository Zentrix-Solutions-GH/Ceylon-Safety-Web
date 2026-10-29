-- Fix 1: Revoke EXECUTE on ALL private schema functions from anon and authenticated.
-- Supabase's ALTER DEFAULT PRIVILEGES grants EXECUTE to PUBLIC (which includes anon
-- and authenticated) on all functions created after that grant, even in the private
-- schema. The schema-level REVOKE ALL FROM PUBLIC in S-011 strips the implicit
-- PUBLIC privilege but does not remove explicit role grants that Supabase adds via
-- default privileges. Revoke them explicitly here.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA private FROM anon, authenticated;

-- Fix 2: Update private.handle_new_user to call public.create_profile_for(auth.users).
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
