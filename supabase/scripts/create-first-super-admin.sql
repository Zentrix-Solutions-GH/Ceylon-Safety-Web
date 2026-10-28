-- supabase/scripts/create-first-super-admin.sql
-- S-012: One-off script to create the first Super Admin account.
--
-- Run as the owner connection (service_role or postgres):
--   psql "$DATABASE_URL" -v profile_id='<uuid>' -f supabase/scripts/create-first-super-admin.sql
--
-- The profile must already exist in public.profiles (the person must have
-- registered a normal account and verified their email first).
-- The script is idempotent: running it twice for the same id is safe.
-- Prints NO secrets.

DO $$
DECLARE
  v_profile_id uuid;
  v_display    text;
BEGIN
  -- :profile_id is supplied via -v flag; psql replaces it before sending to the server
  BEGIN
    v_profile_id := :'profile_id'::uuid;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'profile_id parameter is missing or not a valid UUID. '
      'Run with: psql ... -v profile_id=''<uuid>'' -f create-first-super-admin.sql';
  END;

  -- Confirm the profile exists
  SELECT display_name INTO v_display
    FROM public.profiles
   WHERE id = v_profile_id;

  IF v_display IS NULL THEN
    RAISE EXCEPTION 'No profile found for id %. The person must sign up and verify their email first.', v_profile_id;
  END IF;

  -- Insert; ON CONFLICT DO NOTHING makes it idempotent
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_profile_id, 'super_admin')
  ON CONFLICT (user_id) DO NOTHING;

  RAISE NOTICE 'Super Admin row inserted (or already existed) for profile %.', v_profile_id;
  RAISE NOTICE 'Display name: %', v_display;
  RAISE NOTICE 'Done. Verify with: SELECT user_id, role FROM public.user_roles WHERE role = ''super_admin'';';
END;
$$;
