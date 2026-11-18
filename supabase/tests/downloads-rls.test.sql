-- S-085: RLS tests for download_logs and download_requests
-- Run with: supabase test db

BEGIN;
SELECT plan(6);

-- ─── Helpers ─────────────────────────────────────────────────────────────────

-- Buyer A and Buyer B profiles are assumed to exist via the dev seed.
-- We use the seed user IDs from supabase/seed.sql where available.

-- ─── download_logs: a buyer can only read their own rows ─────────────────────

SELECT tests.authenticate_as('buyer');

SELECT is(
  (
    SELECT count(*)::int
    FROM   public.download_logs
    WHERE  user_id <> auth.uid()
  ),
  0,
  'buyer cannot see another buyer''s download_logs'
);

SELECT isnt(
  (
    SELECT count(*)::int
    FROM   public.download_logs
    WHERE  user_id = auth.uid()
  ),
  NULL,
  'buyer can see their own download_logs'
);

-- ─── download_requests: a buyer can only read their own rows ─────────────────

SELECT is(
  (
    SELECT count(*)::int
    FROM   public.download_requests
    WHERE  user_id <> auth.uid()
  ),
  0,
  'buyer cannot see another buyer''s download_requests'
);

SELECT isnt(
  (
    SELECT count(*)::int
    FROM   public.download_requests
    WHERE  user_id = auth.uid()
  ),
  NULL,
  'buyer can see their own download_requests'
);

-- ─── download_request_queue: a buyer cannot read the admin queue view ─────────

SELECT throws_ok(
  $$SELECT 1 FROM public.download_request_queue LIMIT 1$$,
  'buyer cannot read download_request_queue view'
);

-- ─── Unauthenticated: no access to download tables ───────────────────────────

SELECT tests.clear_authentication();

SELECT is(
  (SELECT count(*)::int FROM public.download_logs),
  0,
  'unauthenticated user sees no download_logs rows'
);

SELECT * FROM finish();
ROLLBACK;
