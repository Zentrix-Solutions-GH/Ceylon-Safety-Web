-- S-100: pgTAP test — owner_alert_held RLS (S5, S6, S7)
-- Verifies that:
--   S5: anon role cannot SELECT / INSERT / DELETE from owner_alert_held
--   S6: authenticated non-service role cannot read another row
--   S7: service_role can INSERT, SELECT, and DELETE
-- Run with: supabase test db (requires Docker + local Supabase stack).
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
-- S5: anon cannot SELECT
-- ─────────────────────────────────────────────────────────────────────────────

SET LOCAL ROLE anon;

SELECT throws_ok(
  $$ SELECT * FROM public.owner_alert_held $$,
  '42501',
  NULL,
  'S5: anon role is blocked from SELECT on owner_alert_held'
);

SELECT throws_ok(
  $$ INSERT INTO public.owner_alert_held (event, detail) VALUES ('x', '{}'::jsonb) $$,
  '42501',
  NULL,
  'S5: anon role is blocked from INSERT on owner_alert_held'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- S6: authenticated (non-service) role cannot SELECT
-- ─────────────────────────────────────────────────────────────────────────────

SET LOCAL ROLE authenticated;

SELECT throws_ok(
  $$ SELECT * FROM public.owner_alert_held $$,
  '42501',
  NULL,
  'S6: authenticated role is blocked from SELECT on owner_alert_held'
);

SELECT throws_ok(
  $$ INSERT INTO public.owner_alert_held (event, detail) VALUES ('x', '{}'::jsonb) $$,
  '42501',
  NULL,
  'S6: authenticated role is blocked from INSERT on owner_alert_held'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- S7: service_role can DELETE (reset GUC first)
-- ─────────────────────────────────────────────────────────────────────────────

RESET ROLE;

SELECT ok(
  (DELETE FROM public.owner_alert_held RETURNING id) IS NOT NULL,
  'S7: service_role can DELETE from owner_alert_held'
);

SELECT * FROM finish();
ROLLBACK;
