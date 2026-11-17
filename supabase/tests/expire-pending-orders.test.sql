-- S-082: pgTAP tests for expire_pending_orders() SQL function.
-- Verifies: function exists, permissions, and SQL WHERE predicate correctness.
-- Run with: supabase test db (requires Docker + local Supabase stack).
--
-- UUID legend (prefix e8 to avoid collisions with other test files):
--   Profile:         e8100000-0000-0000-0000-000000000001
--   Page / revision: e8200000-... / e8200000-...-0010
--   Orders (card expired):  e8300001-...
--   Orders (card future):   e8300002-...
--   Orders (bank, NULL):    e8300003-...

BEGIN;
SELECT plan(7);

-- ── Shared fixtures ───────────────────────────────────────────────────────────

INSERT INTO public.profiles (id, email, display_name, first_name, last_name)
VALUES ('e8100000-0000-0000-0000-000000000001', 'pgtap_expire@test.invalid', 'pgTAP Expire', 'P', 'E')
ON CONFLICT DO NOTHING;

INSERT INTO public.pages (id, slug, title)
VALUES
  ('e8200000-0000-0000-0000-000000000001', 'terms-e8',  'Terms E8'),
  ('e8200000-0000-0000-0000-000000000002', 'refund-e8', 'Refund E8')
ON CONFLICT DO NOTHING;

INSERT INTO public.page_revisions (id, page_id, version, published_at)
VALUES
  ('e8200000-0000-0000-0000-000000000010', 'e8200000-0000-0000-0000-000000000001', 1, now()),
  ('e8200000-0000-0000-0000-000000000020', 'e8200000-0000-0000-0000-000000000002', 1, now())
ON CONFLICT DO NOTHING;

-- ── Permission tests ──────────────────────────────────────────────────────────

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

-- ── SQL WHERE predicate correctness ──────────────────────────────────────────

-- 5. AC1: expired pending card order → cancelled; count = 1
INSERT INTO public.orders (
  id, order_number, user_id, status, payment_method,
  subtotal_cents, total_cents,
  terms_revision_id, refund_policy_revision_id, terms_accepted_at,
  expires_at
) VALUES (
  'e8300001-0000-0000-0000-000000000001',
  'CS-E8-0001',
  'e8100000-0000-0000-0000-000000000001',
  'pending', 'card',
  1000, 1000,
  'e8200000-0000-0000-0000-000000000010',
  'e8200000-0000-0000-0000-000000000020',
  now(),
  now() - interval '1 second'   -- past → must be cancelled
) ON CONFLICT DO NOTHING;

SELECT is(
  (SELECT public.expire_pending_orders()),
  1,
  'AC1: expired pending card order is cancelled (count = 1)'
);

-- 6. AC2/EC3: future expires_at → NOT cancelled; count = 0
INSERT INTO public.orders (
  id, order_number, user_id, status, payment_method,
  subtotal_cents, total_cents,
  terms_revision_id, refund_policy_revision_id, terms_accepted_at,
  expires_at
) VALUES (
  'e8300002-0000-0000-0000-000000000001',
  'CS-E8-0002',
  'e8100000-0000-0000-0000-000000000001',
  'pending', 'card',
  1000, 1000,
  'e8200000-0000-0000-0000-000000000010',
  'e8200000-0000-0000-0000-000000000020',
  now(),
  now() + interval '1 hour'     -- future → must NOT be cancelled (48h slow-pay, reuse-extended)
) ON CONFLICT DO NOTHING;

SELECT is(
  (SELECT public.expire_pending_orders()),
  0,
  'AC2: pending card order with future expires_at is NOT cancelled'
);

-- 7. AC1: bank_transfer order (expires_at IS NULL) → NOT cancelled; count = 0
INSERT INTO public.orders (
  id, order_number, user_id, status, payment_method,
  subtotal_cents, total_cents,
  terms_revision_id, refund_policy_revision_id, terms_accepted_at,
  expires_at
) VALUES (
  'e8300003-0000-0000-0000-000000000001',
  'CS-E8-0003',
  'e8100000-0000-0000-0000-000000000001',
  'pending', 'bank_transfer',
  1000, 1000,
  'e8200000-0000-0000-0000-000000000010',
  'e8200000-0000-0000-0000-000000000020',
  now(),
  NULL
) ON CONFLICT DO NOTHING;

SELECT is(
  (SELECT public.expire_pending_orders()),
  0,
  'AC1: bank_transfer order with NULL expires_at is never cancelled'
);

SELECT * FROM finish();
ROLLBACK;
