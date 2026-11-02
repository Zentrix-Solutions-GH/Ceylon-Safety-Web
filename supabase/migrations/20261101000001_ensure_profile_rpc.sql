-- S-032: Public RPC wrapper so requireUser() can call the same profile-creation
-- logic as the signup trigger (AC2). Only service_role may call this.
CREATE OR REPLACE FUNCTION public.ensure_profile_for_user(
  p_user_id   uuid,
  p_email     text,
  p_app_meta  jsonb DEFAULT '{}',
  p_user_meta jsonb DEFAULT '{}'
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
BEGIN
  PERFORM private.create_profile_for(p_user_id, p_email, p_app_meta, p_user_meta);
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_profile_for_user(uuid, text, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_profile_for_user(uuid, text, jsonb, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.ensure_profile_for_user(uuid, text, jsonb, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_profile_for_user(uuid, text, jsonb, jsonb)
  TO service_role;
