-- S-083: pgTAP RLS tests for bank_transfer_slips.
-- Verifies: buyer reads own rows; buyer cannot read another buyer's rows; anon reads nothing.
-- Run with: supabase test db (requires Docker + local Supabase stack).
--
-- UUID legend (prefix e9 to avoid collisions with other test files):
--   Buyer A profile:  e9100000-0000-0000-0000-000000000001
--   Buyer B profile:  e9100000-0000-0000-0000-000000000002
--   Order A:          e9300000-0000-0000-0000-000000000001
--   Slip A1:          e9400000-0000-0000-0000-000000000001  (belongs to Buyer A)
--   Slip B1:          e9400000-0000-0000-0000-000000000002  (belongs to Buyer B)

BEGIN;
SELECT plan(12);

-- ── Fixtures ──────────────────────────────────────────────────────────────────

INSERT INTO public.profiles (id, email, display_name, first_name, last_name)
VALUES
  ('e9100000-0000-0000-0000-000000000001', 'buyer_a@test.invalid', 'Buyer A', 'A', 'A'),
  ('e9100000-0000-0000-0000-000000000002', 'buyer_b@test.invalid', 'Buyer B', 'B', 'B')
ON CONFLICT DO NOTHING;

INSERT INTO public.pages (id, slug, title)
VALUES
  ('e9200000-0000-0000-0000-000000000001', 'terms-e9',  'Terms E9'),
  ('e9200000-0000-0000-0000-000000000002', 'refund-e9', 'Refund E9')
ON CONFLICT DO NOTHING;

INSERT INTO public.page_revisions (id, page_id, version, published_at)
VALUES
  ('e9200000-0000-0000-0000-000000000010', 'e9200000-0000-0000-0000-000000000001', 1, now()),
  ('e9200000-0000-0000-0000-000000000020', 'e9200000-0000-0000-0000-000000000002', 1, now())
ON CONFLICT DO NOTHING;

INSERT INTO public.orders (
  id, user_id, order_number, status, payment_provider, payment_method,
  terms_revision_id, refund_policy_revision_id,
  subtotal_cents, discount_cents, total_cents, currency,
  terms_accepted_at
)
VALUES (
  'e9300000-0000-0000-0000-000000000001',
  'e9100000-0000-0000-0000-000000000001',
  'CS-TEST-E9-001',
  'pending_verification',
  'bank_transfer',
  'bank_transfer',
  'e9200000-0000-0000-0000-000000000010',
  'e9200000-0000-0000-0000-000000000020',
  100000, 0, 100000, 'LKR',
  now()
)
ON CONFLICT DO NOTHING;

INSERT INTO public.bank_transfer_slips (id, order_id, uploaded_by, file_key, mime_type, size_bytes)
VALUES
  ('e9400000-0000-0000-0000-000000000001',
   'e9300000-0000-0000-0000-000000000001',
   'e9100000-0000-0000-0000-000000000001',
   'slips/e9300000/e9400000-slip-a1.jpg', 'image/jpeg', 50000),
  -- Buyer B uploads a slip on a different order (we reuse the same order FK for simplicity;
  -- the RLS check is on uploaded_by, so this correctly tests cross-buyer isolation).
  ('e9400000-0000-0000-0000-000000000002',
   'e9300000-0000-0000-0000-000000000001',
   'e9100000-0000-0000-0000-000000000002',
   'slips/e9300000/e9400000-slip-b1.jpg', 'image/jpeg', 60000)
ON CONFLICT DO NOTHING;

-- ── 1. Table exists ───────────────────────────────────────────────────────────

SELECT has_table('public', 'bank_transfer_slips', 'bank_transfer_slips table exists');

-- ── 2. RLS is enabled ─────────────────────────────────────────────────────────

SELECT policies_are(
  'public',
  'bank_transfer_slips',
  ARRAY['slips_insert_own', 'slips_select_own', 'slips_staff_read', 'slips_staff_update'],
  'bank_transfer_slips has the expected RLS policies'
);

-- ── 3. Anon sees nothing ──────────────────────────────────────────────────────

SET LOCAL ROLE anon;

SELECT is(
  (SELECT count(*)::int FROM public.bank_transfer_slips),
  0,
  'anon user sees no slip rows'
);

RESET ROLE;

-- ── 4. Buyer A sees only their own row ───────────────────────────────────────

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub": "e9100000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT is(
  (SELECT count(*)::int FROM public.bank_transfer_slips),
  1,
  'buyer A sees exactly 1 row (their own)'
);

SELECT is(
  (SELECT id::text FROM public.bank_transfer_slips LIMIT 1),
  'e9400000-0000-0000-0000-000000000001',
  'buyer A sees slip A1'
);

RESET ROLE;

-- ── 5. Buyer B cannot see Buyer A's row ──────────────────────────────────────

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub": "e9100000-0000-0000-0000-000000000002", "role": "authenticated"}';

SELECT is(
  (SELECT count(*)::int FROM public.bank_transfer_slips WHERE id = 'e9400000-0000-0000-0000-000000000001'),
  0,
  'buyer B cannot read buyer A slip'
);

RESET ROLE;

-- ── 6. Buyer A can insert a slip on their own order ──────────────────────────

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub": "e9100000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT lives_ok(
  $$INSERT INTO public.bank_transfer_slips (id, order_id, uploaded_by, file_key, mime_type, size_bytes)
    VALUES ('e9400000-0000-0000-0000-000000000003',
            'e9300000-0000-0000-0000-000000000001',
            'e9100000-0000-0000-0000-000000000001',
            'slips/e9300000/e9400000-slip-a2.jpg', 'image/jpeg', 70000)$$,
  'buyer A can insert a slip on their own pending_verification bank-transfer order'
);

RESET ROLE;

-- ── 7. Buyer B cannot insert a slip on Buyer A order ─────────────────────────

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub": "e9100000-0000-0000-0000-000000000002", "role": "authenticated"}';

SELECT throws_ok(
  $$INSERT INTO public.bank_transfer_slips (id, order_id, uploaded_by, file_key, mime_type, size_bytes)
    VALUES ('e9400000-0000-0000-0000-000000000004',
            'e9300000-0000-0000-0000-000000000001',
            'e9100000-0000-0000-0000-000000000002',
            'slips/e9300000/e9400000-slip-b2.jpg', 'image/jpeg', 80000)$$,
  '42501',
  NULL,
  'buyer B cannot insert a slip on another buyer''s order (RLS violation)'
);

RESET ROLE;

-- ── 8. buyer_slip_summary: file_key column absent from view ──────────────────

SELECT hasnt_column(
  'public', 'buyer_slip_summary', 'file_key',
  'buyer_slip_summary does not expose file_key column'
);

-- ── 9–10. buyer_slip_summary: cross-buyer row isolation via RLS ───────────────

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub": "e9100000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT is(
  (SELECT count(*)::int FROM public.buyer_slip_summary),
  2,  -- slip A1 + the one inserted in test 6 (slip A2)
  'buyer A sees only their own rows in buyer_slip_summary'
);

SELECT is(
  (SELECT count(*)::int FROM public.buyer_slip_summary
    WHERE id = 'e9400000-0000-0000-0000-000000000002'),
  0,
  'buyer A cannot read buyer B slip via buyer_slip_summary'
);

RESET ROLE;

-- ── 11. cancel_order_locked returns slip_uploaded when a slip row exists (AC7) ─

-- Run as buyer A (the order owner) with their JWT.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub": "e9100000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT is(
  (SELECT public.cancel_order_locked(
    'e9100000-0000-0000-0000-000000000001'::uuid,
    'e9300000-0000-0000-0000-000000000001'::uuid
  ) ->> 'action'),
  'slip_uploaded',
  'cancel_order_locked returns slip_uploaded when bank_transfer_slips row exists for the order'
);

RESET ROLE;

-- ── Cleanup ───────────────────────────────────────────────────────────────────
-- All fixtures are cleaned up by the ROLLBACK below.
-- (page_revisions is append-only and pages has FK deps; explicit DELETEs not needed.)

SELECT * FROM finish();
ROLLBACK;
