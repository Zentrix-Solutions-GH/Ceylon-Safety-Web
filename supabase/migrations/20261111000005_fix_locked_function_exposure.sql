-- S-078: Fix function exposure for create_order_locked and cancel_order_locked.
-- PostgreSQL grants EXECUTE to PUBLIC on new functions by default; Supabase's
-- ALTER DEFAULT PRIVILEGES additionally grants to anon and authenticated.
-- REVOKE FROM anon alone does not block anon because it still inherits EXECUTE
-- from PUBLIC. The correct pattern (see 20261028000002 for profile_is_super_admin)
-- is REVOKE ALL FROM PUBLIC (strips both the PUBLIC and implicit inheritance paths)
-- then GRANT EXECUTE only to authenticated.

REVOKE ALL ON FUNCTION public.create_order_locked(uuid, text, text, text, jsonb, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_order_locked(uuid, text, text, text, jsonb, jsonb)
  TO authenticated;

REVOKE ALL ON FUNCTION public.cancel_order_locked(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_order_locked(uuid, uuid)
  TO authenticated;
