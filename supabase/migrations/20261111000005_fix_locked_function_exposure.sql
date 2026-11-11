-- S-078: Fix function exposure for create_order_locked and cancel_order_locked.
-- Supabase's ALTER DEFAULT PRIVILEGES grants EXECUTE to anon and authenticated on
-- all public functions when they are first created. A REVOKE in the same migration
-- as the CREATE FUNCTION is overridden by the default privilege application that
-- runs after each migration completes. This separate migration strips the anon
-- grant after the fact, following the same pattern as 20261029000002.
--
-- authenticated retains EXECUTE — TypeScript calls these via supabase.rpc() with
-- a session token; the auth.uid() assertion inside each function is the security
-- boundary. anon must not call either function at the SQL privilege level.

REVOKE EXECUTE ON FUNCTION public.create_order_locked(uuid, text, text, text, jsonb, jsonb)
  FROM anon;

REVOKE EXECUTE ON FUNCTION public.cancel_order_locked(uuid, uuid)
  FROM anon;
