-- S-100: pgTAP test — owner_alert_held RLS (S5, S6, S7)
-- Verifies that:
--   S5: anon role sees 0 rows (RLS blocks) and cannot INSERT
--   S6: authenticated role sees 0 rows (RLS blocks) and cannot INSERT
--   S7: service_role (postgres session) can INSERT, SELECT, and DELETE
-- Run with: supabase test db (requires Docker + local Supabase stack).
--
-- Note: RLS with no matching policy returns 0 rows for SELECT (not 42501).
-- The 42501 only fires for INSERT/UPDATE/DELETE where the check fails.
-- INSERT on a table with no matching policy raises "violates row-level security".
--
-- Assertion count: 6

BEGIN;
SELECT plan(6);

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed a held-alert row via service_role (no GUC needed — postgres default)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.owner_alert_held (event, detail)
VALUES ('settings.super_admin_change', '{"actorName":"Test"}'::jsonb);

-- ─────────────────────────────────────────────────────────────────────────────
-- S7: service_role (postgres) can SELECT
-- ─────────────────────────────────────────────────────────────────────────────

SELECT ok(
  (SELECT count(*) FROM public.owner_alert_held) > 0,
  'S7: service_role can SELECT from owner_alert_held'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- S5: anon sees 0 rows (RLS denies) and cannot INSERT
-- ─────────────────────────────────────────────────────────────────────────────

SET LOCAL ROLE anon;

SELECT is(
  (SELECT count(*)::int FROM public.owner_alert_held),
  0,
  'S5: anon role sees 0 rows from owner_alert_held (RLS denies)'
);

SELECT throws_ok(
  $$ INSERT INTO public.owner_alert_held (event, detail) VALUES ('x', '{}'::jsonb) $$,
  '42501',
  NULL,
  'S5: anon role is blocked from INSERT on owner_alert_held'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- S6: authenticated (non-service) role sees 0 rows and cannot INSERT
-- ─────────────────────────────────────────────────────────────────────────────

SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*)::int FROM public.owner_alert_held),
  0,
  'S6: authenticated role sees 0 rows from owner_alert_held (RLS denies)'
);

SELECT throws_ok(
  $$ INSERT INTO public.owner_alert_held (event, detail) VALUES ('x', '{}'::jsonb) $$,
  '42501',
  NULL,
  'S6: authenticated role is blocked from INSERT on owner_alert_held'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- S7: service_role can DELETE (reset role first)
-- ─────────────────────────────────────────────────────────────────────────────

RESET ROLE;

WITH deleted AS (
  DELETE FROM public.owner_alert_held RETURNING id
)
SELECT ok(
  (SELECT count(*) FROM deleted) > 0,
  'S7: service_role can DELETE from owner_alert_held'
);

SELECT * FROM finish();
ROLLBACK;
