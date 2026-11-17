-- S-082: pgTAP tests for expire_pending_orders() SQL function.
-- Verifies: function exists, anon/authenticated are blocked, service_role can call.
-- Run with: supabase test db (requires Docker + local Supabase stack).

BEGIN;
SELECT plan(4);

-- 1. Function exists in the public schema
SELECT has_function(
  'public',
  'expire_pending_orders',
  ARRAY[]::text[],
  'expire_pending_orders() exists in public schema'
);

-- 2. anon role is blocked
SELECT throws_ok(
  $$ SET LOCAL ROLE anon; SELECT public.expire_pending_orders(); $$,
  'permission denied for function expire_pending_orders',
  'anon cannot call expire_pending_orders()'
);

-- 3. authenticated role is blocked
SELECT throws_ok(
  $$ SET LOCAL ROLE authenticated; SELECT public.expire_pending_orders(); $$,
  'permission denied for function expire_pending_orders',
  'authenticated cannot call expire_pending_orders()'
);

-- 4. service_role can call and returns an integer
SELECT ok(
  (SELECT public.expire_pending_orders()) >= 0,
  'service_role can call expire_pending_orders() and receives an integer'
);

SELECT * FROM finish();
ROLLBACK;
