-- S-084: pgTAP tests for approve_bank_transfer_locked PL/pgSQL function (AC6).
-- Tests the atomic approval transaction: slip acceptance, order marked paid,
-- entitlement creation, cart removal, first_approved path, already_done idempotency.
-- Run with: supabase test db (requires Docker + local Supabase stack).
--
-- UUID legend (prefix e8 to avoid collisions with other test files):
--   Staff A:          e8100000-0000-0000-0000-000000000001
--   Staff B:          e8100000-0000-0000-0000-000000000002
--   Buyer:            e8100000-0000-0000-0000-000000000003
--   Document:         e8200000-0000-0000-0000-000000000001
--   Order (small):    e8300000-0000-0000-0000-000000000001  (100 000 LKR < threshold)
--   Order (large):    e8300000-0000-0000-0000-000000000002  (3 000 000 LKR > threshold)
--   Slip (small):     e8400000-0000-0000-0000-000000000001
--   Slip (large):     e8400000-0000-0000-0000-000000000002
--   Order item:       e8500000-0000-0000-0000-000000000001
--   Order item large: e8500000-0000-0000-0000-000000000002
--   Cart item:        e8600000-0000-0000-0000-000000000001

BEGIN;
SELECT plan(9);

-- ── Fixtures ──────────────────────────────────────────────────────────────────

INSERT INTO public.profiles (id, email, display_name, first_name, last_name)
VALUES
  ('e8100000-0000-0000-0000-000000000001', 'staff_a@e8.invalid', 'Staff A', 'A', 'A'),
  ('e8100000-0000-0000-0000-000000000002', 'staff_b@e8.invalid', 'Staff B', 'B', 'B'),
  ('e8100000-0000-0000-0000-000000000003', 'buyer_e8@e8.invalid', 'Buyer E8', 'E', '8')
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

INSERT INTO public.documents (id, title, slug, language, type, price_cents, status)
VALUES (
  'e8200000-0000-0000-0000-000000000001',
  'E8 Test Doc', 'e8-test-doc', 'en', 'checklist', 50000, 'published'
)
ON CONFLICT DO NOTHING;

INSERT INTO public.orders (
  id, user_id, order_number, status, payment_provider, payment_method,
  terms_revision_id, refund_policy_revision_id,
  subtotal_cents, discount_cents, total_cents, currency, terms_accepted_at
)
VALUES
  -- Small order: 100 000 LKR (below 2 500 000 threshold → one approval)
  (
    'e8300000-0000-0000-0000-000000000001',
    'e8100000-0000-0000-0000-000000000003',
    'CS-TEST-E8-001', 'pending_verification', 'bank_transfer', 'bank_transfer',
    'e8200000-0000-0000-0000-000000000010', 'e8200000-0000-0000-0000-000000000020',
    100000, 0, 100000, 'LKR', now()
  ),
  -- Large order: 3 000 000 LKR (above threshold → two approvals)
  (
    'e8300000-0000-0000-0000-000000000002',
    'e8100000-0000-0000-0000-000000000003',
    'CS-TEST-E8-002', 'pending_verification', 'bank_transfer', 'bank_transfer',
    'e8200000-0000-0000-0000-000000000010', 'e8200000-0000-0000-0000-000000000020',
    3000000, 0, 3000000, 'LKR', now()
  )
ON CONFLICT DO NOTHING;

INSERT INTO public.order_items (id, order_id, item_type, document_id, language, title_snapshot, unit_price_cents, line_total_cents)
VALUES
  ('e8500000-0000-0000-0000-000000000001',
   'e8300000-0000-0000-0000-000000000001',
   'document', 'e8200000-0000-0000-0000-000000000001', 'en',
   'E8 Test Doc', 50000, 100000),
  ('e8500000-0000-0000-0000-000000000002',
   'e8300000-0000-0000-0000-000000000002',
   'document', 'e8200000-0000-0000-0000-000000000001', 'en',
   'E8 Test Doc', 50000, 3000000)
ON CONFLICT DO NOTHING;

INSERT INTO public.bank_transfer_slips (id, order_id, uploaded_by, file_key, mime_type, size_bytes)
VALUES
  ('e8400000-0000-0000-0000-000000000001',
   'e8300000-0000-0000-0000-000000000001',
   'e8100000-0000-0000-0000-000000000003',
   'slips/e8300000-001/slip.jpg', 'image/jpeg', 50000),
  ('e8400000-0000-0000-0000-000000000002',
   'e8300000-0000-0000-0000-000000000002',
   'e8100000-0000-0000-0000-000000000003',
   'slips/e8300000-002/slip.jpg', 'image/jpeg', 50000)
ON CONFLICT DO NOTHING;

INSERT INTO public.cart_items (user_id, document_id)
VALUES ('e8100000-0000-0000-0000-000000000003', 'e8200000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- ── 1. Single approval (small order) → outcome = 'applied' ───────────────────

SELECT is(
  (SELECT public.approve_bank_transfer_locked(
    'e8300000-0000-0000-0000-000000000001'::uuid,
    'e8400000-0000-0000-0000-000000000001'::uuid,
    'e8100000-0000-0000-0000-000000000001'::uuid,
    3,       -- download_limit
    2500000  -- threshold_cents
  ) ->> 'outcome'),
  'applied',
  'single approval on small order returns applied'
);

-- ── 2. Order is marked paid after approval ────────────────────────────────────

SELECT is(
  (SELECT status FROM public.orders WHERE id = 'e8300000-0000-0000-0000-000000000001'),
  'paid',
  'order status = paid after approval'
);

-- ── 3. Entitlement row created ────────────────────────────────────────────────

SELECT is(
  (SELECT count(*)::int FROM public.entitlements
    WHERE order_item_id = 'e8500000-0000-0000-0000-000000000001'),
  1,
  'one entitlement row created for the order item'
);

-- ── 4. Download limit is applied to entitlement ───────────────────────────────

SELECT is(
  (SELECT download_limit FROM public.entitlements
    WHERE order_item_id = 'e8500000-0000-0000-0000-000000000001'),
  3,
  'entitlement has the download_limit passed to the function'
);

-- ── 5. Cart item removed after approval ──────────────────────────────────────

SELECT is(
  (SELECT count(*)::int FROM public.cart_items
    WHERE user_id = 'e8100000-0000-0000-0000-000000000003'
      AND document_id = 'e8200000-0000-0000-0000-000000000001'),
  0,
  'cart item removed after final approval'
);

-- ── 6. Slip status = accepted after approval ──────────────────────────────────

SELECT is(
  (SELECT status FROM public.bank_transfer_slips WHERE id = 'e8400000-0000-0000-0000-000000000001'),
  'accepted',
  'slip status = accepted after approval'
);

-- ── 7. already_done is idempotent (order already paid) ───────────────────────

SELECT is(
  (SELECT public.approve_bank_transfer_locked(
    'e8300000-0000-0000-0000-000000000001'::uuid,
    'e8400000-0000-0000-0000-000000000001'::uuid,
    'e8100000-0000-0000-0000-000000000001'::uuid,
    3, 2500000
  ) ->> 'outcome'),
  'already_done',
  'second call on paid order returns already_done (idempotent)'
);

-- ── 8. First approval on large order → outcome = 'first_approved' ────────────

SELECT is(
  (SELECT public.approve_bank_transfer_locked(
    'e8300000-0000-0000-0000-000000000002'::uuid,
    'e8400000-0000-0000-0000-000000000002'::uuid,
    'e8100000-0000-0000-0000-000000000001'::uuid,
    3, 2500000
  ) ->> 'outcome'),
  'first_approved',
  'first approval on large order returns first_approved'
);

-- ── 9. Large order status still pending_verification after first approval ─────

SELECT is(
  (SELECT status FROM public.orders WHERE id = 'e8300000-0000-0000-0000-000000000002'),
  'pending_verification',
  'large order stays pending_verification after first approval'
);

-- ── Cleanup ───────────────────────────────────────────────────────────────────
SELECT * FROM finish();
ROLLBACK;
