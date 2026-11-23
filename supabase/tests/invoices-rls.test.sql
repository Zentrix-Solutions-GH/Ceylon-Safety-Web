-- S-087: pgTAP tests for invoices table RLS
-- Verifies: customers read own rows only; staff read all; anon reads nothing;
-- direct write (INSERT/UPDATE/DELETE) by customers is blocked.
-- Run with: supabase test db

BEGIN;
SELECT plan(7);

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.profiles (id, email, display_name, first_name, last_name)
VALUES
  ('a1000000-0000-0000-0000-000000000001', 'inv_cust_a@test.invalid', 'Inv A', 'Inv', 'A'),
  ('b1000000-0000-0000-0000-000000000001', 'inv_cust_b@test.invalid', 'Inv B', 'Inv', 'B'),
  ('f1000000-0000-0000-0000-000000000099', 'inv_staff@test.invalid',  'Inv Staff', 'Staff', 'S')
ON CONFLICT DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
VALUES ('f1000000-0000-0000-0000-000000000099', 'admin')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, action)
VALUES ('admin', 'orders.*')
ON CONFLICT DO NOTHING;

-- Need a terms page revision for orders FK
INSERT INTO public.pages (id, slug, title)
VALUES ('c1000000-0000-0000-0000-000000000001', 'inv-rls-terms', 'Terms')
ON CONFLICT DO NOTHING;

INSERT INTO public.page_revisions (id, page_id, version, published_at)
VALUES ('c1000000-0000-0000-0000-000000000010', 'c1000000-0000-0000-0000-000000000001', 1, now())
ON CONFLICT DO NOTHING;

INSERT INTO public.pages (id, slug, title)
VALUES ('c1000000-0000-0000-0000-000000000002', 'inv-rls-refund', 'Refund')
ON CONFLICT DO NOTHING;

INSERT INTO public.page_revisions (id, page_id, version, published_at)
VALUES ('c1000000-0000-0000-0000-000000000020', 'c1000000-0000-0000-0000-000000000002', 1, now())
ON CONFLICT DO NOTHING;

-- Orders for customer A and B
INSERT INTO public.orders (id, user_id, status, payment_method, total_cents,
  terms_revision_id, refund_policy_revision_id)
VALUES
  ('d1000000-0000-0000-0000-000000000001',
   'a1000000-0000-0000-0000-000000000001',
   'paid', 'card', 10000,
   'c1000000-0000-0000-0000-000000000010',
   'c1000000-0000-0000-0000-000000000020'),
  ('d1000000-0000-0000-0000-000000000002',
   'b1000000-0000-0000-0000-000000000001',
   'paid', 'card', 20000,
   'c1000000-0000-0000-0000-000000000010',
   'c1000000-0000-0000-0000-000000000020')
ON CONFLICT DO NOTHING;

-- Invoice rows (service role bypasses RLS)
INSERT INTO public.invoices (id, order_id, invoice_number, issued_at,
  seller_snapshot, tax_label, tax_rate_bps, tax_cents, pdf_key)
VALUES
  ('e1000000-0000-0000-0000-000000000001',
   'd1000000-0000-0000-0000-000000000001',
   'INV-2026-RLS-01', now(),
   '{"name":"Test Seller","address":"Test Addr"}'::jsonb,
   NULL, NULL, 0, 'invoices/d1000000-0000-0000-0000-000000000001.pdf'),
  ('e1000000-0000-0000-0000-000000000002',
   'd1000000-0000-0000-0000-000000000002',
   'INV-2026-RLS-02', now(),
   '{"name":"Test Seller","address":"Test Addr"}'::jsonb,
   NULL, NULL, 0, 'invoices/d1000000-0000-0000-0000-000000000002.pdf')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- Tests
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Customer A can read their own invoice
SET LOCAL role TO authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}';

SELECT is(
  (SELECT count(*)::int FROM public.invoices
   WHERE order_id = 'd1000000-0000-0000-0000-000000000001'),
  1,
  'customer A sees exactly 1 invoice — their own'
);

-- 2. Customer A cannot read customer B's invoice
SELECT is(
  (SELECT count(*)::int FROM public.invoices
   WHERE order_id = 'd1000000-0000-0000-0000-000000000002'),
  0,
  'customer A sees 0 invoices for customer B''s order'
);

-- 3. Customer A cannot INSERT an invoice directly
SELECT throws_ok(
  $$INSERT INTO public.invoices (id, order_id, invoice_number, issued_at, seller_snapshot, tax_cents, pdf_key)
    VALUES ('e1000000-0000-0000-0000-000000000099',
            'd1000000-0000-0000-0000-000000000001',
            'INV-FAKE', now(), '{"name":"x","address":"y"}'::jsonb, 0, 'invoices/fake.pdf')$$,
  'new row violates row-level security policy for table "invoices"',
  'customer A cannot INSERT into invoices'
);

-- 4. Customer A cannot DELETE an invoice row
SELECT throws_ok(
  $$DELETE FROM public.invoices WHERE id = 'e1000000-0000-0000-0000-000000000001'$$,
  NULL,
  'customer A cannot DELETE invoice rows'
);

RESET role;
RESET "request.jwt.claims";

-- 5. Anonymous user cannot read any invoice
SET LOCAL role TO anon;

SELECT is(
  (SELECT count(*)::int FROM public.invoices),
  0,
  'anon user sees 0 invoice rows'
);

RESET role;

-- 6. Staff with orders.* can read customer A's invoice
SET LOCAL role TO authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"f1000000-0000-0000-0000-000000000099","role":"authenticated"}';

SELECT is(
  (SELECT count(*)::int FROM public.invoices
   WHERE order_id = 'd1000000-0000-0000-0000-000000000001'),
  1,
  'staff sees customer A''s invoice'
);

-- 7. Staff can read customer B's invoice too (all invoices visible)
SELECT is(
  (SELECT count(*)::int FROM public.invoices
   WHERE order_id = 'd1000000-0000-0000-0000-000000000002'),
  1,
  'staff sees customer B''s invoice'
);

RESET role;
RESET "request.jwt.claims";

SELECT * FROM finish();
ROLLBACK;
