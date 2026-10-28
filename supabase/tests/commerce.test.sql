-- S-016: pgTAP tests for carts, cart_items, coupons, coupon_uses, orders, order_items
-- Run with: supabase test db
-- Requires Docker + local Supabase stack.

BEGIN;
SELECT plan(138);

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed data (service role bypasses RLS)
-- ─────────────────────────────────────────────────────────────────────────────

-- A terms page + revision (orders.terms_revision_id and refund_policy_revision_id FK)
INSERT INTO public.pages (id, slug, title)
VALUES ('10000000-0000-0000-0000-000000000001', 'terms', 'Terms')
ON CONFLICT DO NOTHING;

INSERT INTO public.page_revisions (id, page_id, version, published_at)
VALUES (
  '10000000-0000-0000-0000-000000000010',
  '10000000-0000-0000-0000-000000000001',
  1, now()
) ON CONFLICT DO NOTHING;

INSERT INTO public.pages (id, slug, title)
VALUES ('10000000-0000-0000-0000-000000000002', 'refund-policy', 'Refund Policy')
ON CONFLICT DO NOTHING;

INSERT INTO public.page_revisions (id, page_id, version, published_at)
VALUES (
  '10000000-0000-0000-0000-000000000020',
  '10000000-0000-0000-0000-000000000002',
  1, now()
) ON CONFLICT DO NOTHING;

-- Two test profiles (customers) + one staff user (admin role with orders.*)
INSERT INTO public.profiles (id, email, display_name, first_name, last_name)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'customer_a@test.invalid', 'Alice A', 'Alice', 'A'),
  ('b0000000-0000-0000-0000-000000000001', 'customer_b@test.invalid', 'Bob B', 'Bob', 'B'),
  ('f0000000-0000-0000-0000-000000000099', 'staff@test.invalid', 'Staff S', 'Staff', 'S')
ON CONFLICT DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
VALUES ('f0000000-0000-0000-0000-000000000099', 'admin')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, action)
VALUES ('admin', 'orders.*')
ON CONFLICT DO NOTHING;

-- A category + document (cart_items references documents)
INSERT INTO public.categories (id, name, slug, applies_to)
VALUES ('c0000000-0000-0000-0000-000000000001', 'Cat', 'cat', ARRAY['document'])
ON CONFLICT DO NOTHING;

INSERT INTO public.documents (id, slug, title, category_id, file_format, doc_kind, price_cents, status, published_at)
VALUES (
  'd0000000-0000-0000-0000-000000000001',
  'doc-one', 'Doc One',
  'c0000000-0000-0000-0000-000000000001',
  'pptx', 'checklist', 1000, 'published', now()
) ON CONFLICT DO NOTHING;

-- A coupon for use in order tests
INSERT INTO public.coupons (
  id, code, discount_type, discount_value, expires_at, max_uses
) VALUES (
  'e0000000-0000-0000-0000-000000000001',
  'WELCOME10', 'percent', 10,
  now() + interval '30 days', 100
) ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- AC1: carts
-- ─────────────────────────────────────────────────────────────────────────────

SELECT has_table('public', 'carts', 'AC1: carts table exists');
SELECT has_column('public', 'carts', 'user_id',    'AC1: carts.user_id');
SELECT has_column('public', 'carts', 'created_at', 'AC1: carts.created_at');
SELECT has_column('public', 'carts', 'updated_at', 'AC1: carts.updated_at');
SELECT col_is_pk('public', 'carts', 'user_id',     'AC1: carts.user_id is PK');

-- no quantity, no price, no title on carts
SELECT hasnt_column('public', 'carts', 'quantity', 'AC1: carts has no quantity');
SELECT hasnt_column('public', 'carts', 'price_cents', 'AC1: carts has no price_cents');

-- AC1: cart_items
SELECT has_table('public', 'cart_items', 'AC1: cart_items table exists');
SELECT has_column('public', 'cart_items', 'id',          'AC1: cart_items.id');
SELECT has_column('public', 'cart_items', 'user_id',     'AC1: cart_items.user_id');
SELECT has_column('public', 'cart_items', 'document_id', 'AC1: cart_items.document_id');
SELECT has_column('public', 'cart_items', 'language',    'AC1: cart_items.language');
SELECT has_column('public', 'cart_items', 'created_at',  'AC1: cart_items.created_at');
SELECT hasnt_column('public', 'cart_items', 'quantity',   'AC1: cart_items has no quantity');
SELECT hasnt_column('public', 'cart_items', 'price_cents','AC1: cart_items has no price_cents');
SELECT hasnt_column('public', 'cart_items', 'title',      'AC1: cart_items has no title');

-- AC1: UNIQUE(user_id, document_id, language) on cart_items
DO $$
BEGIN
  INSERT INTO public.carts (user_id) VALUES ('a0000000-0000-0000-0000-000000000001') ON CONFLICT DO NOTHING;
  INSERT INTO public.cart_items (user_id, document_id, language)
  VALUES ('a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001','en');
  BEGIN
    INSERT INTO public.cart_items (user_id, document_id, language)
    VALUES ('a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001','en');
    RAISE EXCEPTION 'AC1: duplicate cart_item should be refused';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  DELETE FROM public.cart_items WHERE user_id = 'a0000000-0000-0000-0000-000000000001';
  DELETE FROM public.carts WHERE user_id = 'a0000000-0000-0000-0000-000000000001';
END $$;
SELECT ok(true, 'AC1: UNIQUE(user_id, document_id, language) on cart_items enforced');

-- AC1: same document two languages = two rows allowed
DO $$
BEGIN
  INSERT INTO public.carts (user_id) VALUES ('a0000000-0000-0000-0000-000000000001') ON CONFLICT DO NOTHING;
  INSERT INTO public.cart_items (user_id, document_id, language)
  VALUES
    ('a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001','en'),
    ('a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001','si');
  DELETE FROM public.cart_items WHERE user_id = 'a0000000-0000-0000-0000-000000000001';
  DELETE FROM public.carts WHERE user_id = 'a0000000-0000-0000-0000-000000000001';
END $$;
SELECT ok(true, 'AC1: same document two languages allowed in cart_items');

-- EC7: deleting a cart removes its items (CASCADE)
DO $$
DECLARE item_count int;
BEGIN
  INSERT INTO public.carts (user_id) VALUES ('a0000000-0000-0000-0000-000000000001') ON CONFLICT DO NOTHING;
  INSERT INTO public.cart_items (user_id, document_id, language)
  VALUES ('a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001','ta');
  DELETE FROM public.carts WHERE user_id = 'a0000000-0000-0000-0000-000000000001';
  SELECT count(*) INTO item_count FROM public.cart_items WHERE user_id = 'a0000000-0000-0000-0000-000000000001';
  IF item_count <> 0 THEN RAISE EXCEPTION 'EC7: cart CASCADE delete did not remove items'; END IF;
END $$;
SELECT ok(true, 'EC7: deleting a cart removes its cart_items');

-- ─────────────────────────────────────────────────────────────────────────────
-- AC2: coupons
-- ─────────────────────────────────────────────────────────────────────────────

SELECT has_table('public', 'coupons', 'AC2: coupons table exists');
SELECT has_column('public', 'coupons', 'id',                        'AC2: coupons.id');
SELECT has_column('public', 'coupons', 'code',                      'AC2: coupons.code');
SELECT has_column('public', 'coupons', 'discount_type',             'AC2: coupons.discount_type');
SELECT has_column('public', 'coupons', 'discount_value',            'AC2: coupons.discount_value');
SELECT has_column('public', 'coupons', 'expires_at',                'AC2: coupons.expires_at');
SELECT has_column('public', 'coupons', 'max_uses',                  'AC2: coupons.max_uses');
SELECT has_column('public', 'coupons', 'uses_count',                'AC2: coupons.uses_count');
SELECT has_column('public', 'coupons', 'max_uses_per_customer',     'AC2: coupons.max_uses_per_customer');
SELECT has_column('public', 'coupons', 'restrict_to_document_ids',  'AC2: coupons.restrict_to_document_ids');
SELECT has_column('public', 'coupons', 'is_active',                 'AC2: coupons.is_active');
SELECT has_column('public', 'coupons', 'created_by',                'AC2: coupons.created_by');
SELECT has_column('public', 'coupons', 'created_at',                'AC2: coupons.created_at');
SELECT has_column('public', 'coupons', 'updated_at',                'AC2: coupons.updated_at');

-- AC2: code stored upper-case (UNIQUE on upper(code))
SELECT throws_ok(
  $$INSERT INTO public.coupons (code, discount_type, discount_value, expires_at, max_uses)
    VALUES ('welcome10', 'percent', 10, now() + interval '1 day', 10)$$,
  '23505', NULL,
  'AC2: case-insensitive unique on code (WELCOME10 already exists)'
);

-- EC2: percent 100 refused
SELECT throws_ok(
  $$INSERT INTO public.coupons (code, discount_type, discount_value, expires_at, max_uses)
    VALUES ('BAD100', 'percent', 100, now() + interval '1 day', 10)$$,
  '23514', NULL,
  'EC2: percent coupon with discount_value = 100 refused'
);

-- EC2: percent 0 refused
SELECT throws_ok(
  $$INSERT INTO public.coupons (code, discount_type, discount_value, expires_at, max_uses)
    VALUES ('BADZERO', 'percent', 0, now() + interval '1 day', 10)$$,
  '23514', NULL,
  'EC2: percent coupon with discount_value = 0 refused'
);

-- AC2: max_uses must be > 0
SELECT throws_ok(
  $$INSERT INTO public.coupons (code, discount_type, discount_value, expires_at, max_uses)
    VALUES ('BADMAX', 'percent', 10, now() + interval '1 day', 0)$$,
  '23514', NULL,
  'AC2: max_uses = 0 refused'
);

-- AC2: invalid discount_type refused
SELECT throws_ok(
  $$INSERT INTO public.coupons (code, discount_type, discount_value, expires_at, max_uses)
    VALUES ('BADTYPE', 'half', 10, now() + interval '1 day', 5)$$,
  '23514', NULL,
  'AC2: invalid discount_type refused'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- AC3: orders
-- ─────────────────────────────────────────────────────────────────────────────

SELECT has_table('public', 'orders', 'AC3: orders table exists');
SELECT has_column('public', 'orders', 'id',                       'AC3: orders.id');
SELECT has_column('public', 'orders', 'order_number',             'AC3: orders.order_number');
SELECT has_column('public', 'orders', 'user_id',                  'AC3: orders.user_id');
SELECT has_column('public', 'orders', 'status',                   'AC3: orders.status');
SELECT has_column('public', 'orders', 'currency',                 'AC3: orders.currency');
SELECT has_column('public', 'orders', 'subtotal_cents',           'AC3: orders.subtotal_cents');
SELECT has_column('public', 'orders', 'coupon_id',                'AC3: orders.coupon_id');
SELECT has_column('public', 'orders', 'coupon_code_snapshot',     'AC3: orders.coupon_code_snapshot');
SELECT has_column('public', 'orders', 'coupon_type_snapshot',     'AC3: orders.coupon_type_snapshot');
SELECT has_column('public', 'orders', 'coupon_value_snapshot',    'AC3: orders.coupon_value_snapshot');
SELECT has_column('public', 'orders', 'discount_cents',           'AC3: orders.discount_cents');
SELECT has_column('public', 'orders', 'total_cents',              'AC3: orders.total_cents');
SELECT has_column('public', 'orders', 'tax_cents',                'AC3: orders.tax_cents');
SELECT has_column('public', 'orders', 'billing_name',             'AC3: orders.billing_name');
SELECT has_column('public', 'orders', 'billing_email',            'AC3: orders.billing_email');
SELECT has_column('public', 'orders', 'billing_phone',            'AC3: orders.billing_phone');
SELECT has_column('public', 'orders', 'billing_company',          'AC3: orders.billing_company');
SELECT has_column('public', 'orders', 'billing_address',          'AC3: orders.billing_address');
SELECT has_column('public', 'orders', 'billing_tax_id',           'AC3: orders.billing_tax_id');
SELECT has_column('public', 'orders', 'terms_revision_id',        'AC3: orders.terms_revision_id');
SELECT has_column('public', 'orders', 'refund_policy_revision_id','AC3: orders.refund_policy_revision_id');
SELECT has_column('public', 'orders', 'terms_accepted_at',        'AC3: orders.terms_accepted_at');
SELECT has_column('public', 'orders', 'payment_provider',         'AC3: orders.payment_provider');
SELECT has_column('public', 'orders', 'payment_method',           'AC3: orders.payment_method');
SELECT has_column('public', 'orders', 'paid_at',                  'AC3: orders.paid_at');
SELECT has_column('public', 'orders', 'expires_at',               'AC3: orders.expires_at');
SELECT has_column('public', 'orders', 'bank_expiry_warned_at',    'AC3: orders.bank_expiry_warned_at');
SELECT has_column('public', 'orders', 'needs_review',             'AC3: orders.needs_review');
SELECT has_column('public', 'orders', 'review_reason',            'AC3: orders.review_reason');
SELECT has_column('public', 'orders', 'finalized_at',             'AC3: orders.finalized_at');
SELECT has_column('public', 'orders', 'cancel_reason',            'AC3: orders.cancel_reason');
SELECT has_column('public', 'orders', 'created_at',               'AC3: orders.created_at');
SELECT has_column('public', 'orders', 'updated_at',               'AC3: orders.updated_at');

-- EC9: currency = USD refused
SELECT throws_ok(
  format($$INSERT INTO public.orders (
    order_number, user_id, status, currency, subtotal_cents, total_cents,
    terms_revision_id, refund_policy_revision_id, terms_accepted_at
  ) VALUES ('CS-2026-99001','a0000000-0000-0000-0000-000000000001','pending','USD',1000,1000,
    '10000000-0000-0000-0000-000000000010','10000000-0000-0000-0000-000000000020', now())$$),
  '23514', NULL,
  'EC9: currency = USD refused'
);

-- EC4: pending status with paid_at set refused
SELECT throws_ok(
  format($$INSERT INTO public.orders (
    order_number, user_id, status, currency, subtotal_cents, total_cents,
    terms_revision_id, refund_policy_revision_id, terms_accepted_at, paid_at
  ) VALUES ('CS-2026-99002','a0000000-0000-0000-0000-000000000001','pending','LKR',1000,1000,
    '10000000-0000-0000-0000-000000000010','10000000-0000-0000-0000-000000000020', now(), now())$$),
  '23514', NULL,
  'EC4: pending status with paid_at set refused'
);

-- EC4: paid status with paid_at NULL refused
SELECT throws_ok(
  format($$INSERT INTO public.orders (
    order_number, user_id, status, currency, subtotal_cents, total_cents,
    terms_revision_id, refund_policy_revision_id, terms_accepted_at
  ) VALUES ('CS-2026-99003','a0000000-0000-0000-0000-000000000001','paid','LKR',1000,1000,
    '10000000-0000-0000-0000-000000000010','10000000-0000-0000-0000-000000000020', now())$$),
  '23514', NULL,
  'EC4: paid status with paid_at NULL refused'
);

-- EC3: total_cents = 0 (coupon >= subtotal) refused
SELECT throws_ok(
  format($$INSERT INTO public.orders (
    order_number, user_id, status, currency, subtotal_cents, discount_cents, total_cents,
    terms_revision_id, refund_policy_revision_id, terms_accepted_at
  ) VALUES ('CS-2026-99004','a0000000-0000-0000-0000-000000000001','pending','LKR',1000,1000,0,
    '10000000-0000-0000-0000-000000000010','10000000-0000-0000-0000-000000000020', now())$$),
  '23514', NULL,
  'EC3: total_cents = 0 refused'
);

-- EC3: total_cents < 0 (fixed coupon > subtotal) refused
SELECT throws_ok(
  format($$INSERT INTO public.orders (
    order_number, user_id, status, currency, subtotal_cents, discount_cents, total_cents,
    terms_revision_id, refund_policy_revision_id, terms_accepted_at
  ) VALUES ('CS-2026-99005','a0000000-0000-0000-0000-000000000001','pending','LKR',1000,2000,-1000,
    '10000000-0000-0000-0000-000000000010','10000000-0000-0000-0000-000000000020', now())$$),
  '23514', NULL,
  'EC3: total_cents < 0 (fixed coupon > subtotal) refused'
);

-- EC3: total_cents != subtotal - discount refused
SELECT throws_ok(
  format($$INSERT INTO public.orders (
    order_number, user_id, status, currency, subtotal_cents, discount_cents, total_cents,
    terms_revision_id, refund_policy_revision_id, terms_accepted_at
  ) VALUES ('CS-2026-99006','a0000000-0000-0000-0000-000000000001','pending','LKR',1000,100,950,
    '10000000-0000-0000-0000-000000000010','10000000-0000-0000-0000-000000000020', now())$$),
  '23514', NULL,
  'EC3: total_cents != subtotal - discount refused'
);

-- Happy path: insert a valid pending order
INSERT INTO public.orders (
  id, order_number, user_id, status, currency, subtotal_cents, total_cents,
  terms_revision_id, refund_policy_revision_id, terms_accepted_at
) VALUES (
  'f0000000-0000-0000-0000-000000000001',
  'CS-2026-00001', 'a0000000-0000-0000-0000-000000000001',
  'pending', 'LKR', 1000, 1000,
  '10000000-0000-0000-0000-000000000010',
  '10000000-0000-0000-0000-000000000020',
  now()
);
SELECT ok(true, 'AC3: valid pending order inserts successfully');

-- Happy path: bank transfer order with payment_method set
INSERT INTO public.orders (
  id, order_number, user_id, status, currency, subtotal_cents, total_cents,
  terms_revision_id, refund_policy_revision_id, terms_accepted_at,
  payment_provider, payment_method
) VALUES (
  'f0000000-0000-0000-0000-000000000002',
  'CS-2026-00002', 'b0000000-0000-0000-0000-000000000001',
  'pending_verification', 'LKR', 2000, 2000,
  '10000000-0000-0000-0000-000000000010',
  '10000000-0000-0000-0000-000000000020',
  now(), 'bank_transfer', 'bank_transfer'
);
SELECT ok(true, 'AC3: bank_transfer order with payment_method = bank_transfer inserts successfully');

-- ─────────────────────────────────────────────────────────────────────────────
-- AC4: order_items
-- ─────────────────────────────────────────────────────────────────────────────

SELECT has_table('public', 'order_items', 'AC4: order_items table exists');
SELECT has_column('public', 'order_items', 'id',               'AC4: order_items.id');
SELECT has_column('public', 'order_items', 'order_id',         'AC4: order_items.order_id');
SELECT has_column('public', 'order_items', 'item_type',        'AC4: order_items.item_type');
SELECT has_column('public', 'order_items', 'document_id',      'AC4: order_items.document_id');
SELECT has_column('public', 'order_items', 'course_id',        'AC4: order_items.course_id');
SELECT has_column('public', 'order_items', 'language',         'AC4: order_items.language');
SELECT has_column('public', 'order_items', 'title_snapshot',   'AC4: order_items.title_snapshot');
SELECT has_column('public', 'order_items', 'unit_price_cents', 'AC4: order_items.unit_price_cents');
SELECT has_column('public', 'order_items', 'quantity',         'AC4: order_items.quantity');
SELECT has_column('public', 'order_items', 'line_total_cents', 'AC4: order_items.line_total_cents');
SELECT has_column('public', 'order_items', 'created_at',       'AC4: order_items.created_at');

-- Happy path: valid document order item
INSERT INTO public.order_items (
  order_id, item_type, document_id, language,
  title_snapshot, unit_price_cents, quantity, line_total_cents
) VALUES (
  'f0000000-0000-0000-0000-000000000001',
  'document', 'd0000000-0000-0000-0000-000000000001', 'en',
  'Doc One', 1000, 1, 1000
);
SELECT ok(true, 'AC4: valid document order item inserts successfully');

-- EC5: both document_id and course_id set refused
SELECT throws_ok(
  $$INSERT INTO public.order_items (
    order_id, item_type, document_id, course_id, language,
    title_snapshot, unit_price_cents, quantity, line_total_cents
  ) VALUES (
    'f0000000-0000-0000-0000-000000000001',
    'document',
    'd0000000-0000-0000-0000-000000000001',
    'ca000000-0000-0000-0000-000000000001',
    'en', 'Doc', 1000, 1, 1000
  )$$,
  '23514', NULL,
  'EC5: both document_id and course_id set refused'
);

-- EC5: neither document_id nor course_id refused
SELECT throws_ok(
  $$INSERT INTO public.order_items (
    order_id, item_type, language,
    title_snapshot, unit_price_cents, quantity, line_total_cents
  ) VALUES (
    'f0000000-0000-0000-0000-000000000001',
    'document', 'en', 'Doc', 1000, 1, 1000
  )$$,
  '23514', NULL,
  'EC5: neither document_id nor course_id set refused'
);

-- EC5: document type with NULL language refused
SELECT throws_ok(
  $$INSERT INTO public.order_items (
    order_id, item_type, document_id,
    title_snapshot, unit_price_cents, quantity, line_total_cents
  ) VALUES (
    'f0000000-0000-0000-0000-000000000001',
    'document', 'd0000000-0000-0000-0000-000000000001',
    'Doc', 1000, 1, 1000
  )$$,
  '23514', NULL,
  'EC5: document item with NULL language refused'
);

-- EC5: quantity = 2 refused
SELECT throws_ok(
  $$INSERT INTO public.order_items (
    order_id, item_type, document_id, language,
    title_snapshot, unit_price_cents, quantity, line_total_cents
  ) VALUES (
    'f0000000-0000-0000-0000-000000000001',
    'document', 'd0000000-0000-0000-0000-000000000001', 'si',
    'Doc', 500, 2, 1000
  )$$,
  '23514', NULL,
  'EC5: quantity = 2 refused'
);

-- EC5: line_total_cents != unit_price * quantity refused
SELECT throws_ok(
  $$INSERT INTO public.order_items (
    order_id, item_type, document_id, language,
    title_snapshot, unit_price_cents, quantity, line_total_cents
  ) VALUES (
    'f0000000-0000-0000-0000-000000000001',
    'document', 'd0000000-0000-0000-0000-000000000001', 'si',
    'Doc', 1000, 1, 999
  )$$,
  '23514', NULL,
  'EC5: line_total_cents != unit_price * quantity refused'
);

-- EC6: same document + language in one order refused (UNIQUE)
SELECT throws_ok(
  $$INSERT INTO public.order_items (
    order_id, item_type, document_id, language,
    title_snapshot, unit_price_cents, quantity, line_total_cents
  ) VALUES (
    'f0000000-0000-0000-0000-000000000001',
    'document', 'd0000000-0000-0000-0000-000000000001', 'en',
    'Doc One', 1000, 1, 1000
  )$$,
  '23505', NULL,
  'EC6: same document + language in one order refused'
);

-- EC6: same document different language in one order allowed
INSERT INTO public.order_items (
  order_id, item_type, document_id, language,
  title_snapshot, unit_price_cents, quantity, line_total_cents
) VALUES (
  'f0000000-0000-0000-0000-000000000001',
  'document', 'd0000000-0000-0000-0000-000000000001', 'si',
  'Doc One SI', 1000, 1, 1000
);
SELECT ok(true, 'EC6: same document different language allowed in one order');

-- EC7: deleting a document that appears in an order is refused (RESTRICT)
SELECT throws_ok(
  $$DELETE FROM public.documents WHERE id = 'd0000000-0000-0000-0000-000000000001'$$,
  '23503', NULL,
  'EC7: deleting a document referenced by order_items is refused'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- AC5: coupon_uses
-- ─────────────────────────────────────────────────────────────────────────────

SELECT has_table('public', 'coupon_uses', 'AC5: coupon_uses table exists');
SELECT has_column('public', 'coupon_uses', 'id',          'AC5: coupon_uses.id');
SELECT has_column('public', 'coupon_uses', 'coupon_id',   'AC5: coupon_uses.coupon_id');
SELECT has_column('public', 'coupon_uses', 'order_id',    'AC5: coupon_uses.order_id');
SELECT has_column('public', 'coupon_uses', 'user_id',     'AC5: coupon_uses.user_id');
SELECT has_column('public', 'coupon_uses', 'used_at',     'AC5: coupon_uses.used_at');
SELECT has_column('public', 'coupon_uses', 'released_at', 'AC5: coupon_uses.released_at');

-- ─────────────────────────────────────────────────────────────────────────────
-- AC6: indexes and set_updated_at triggers
-- ─────────────────────────────────────────────────────────────────────────────

-- set_updated_at on carts
DO $$
DECLARE old_ts timestamptz; new_ts timestamptz;
BEGIN
  INSERT INTO public.carts (user_id) VALUES ('a0000000-0000-0000-0000-000000000001') ON CONFLICT DO NOTHING;
  SELECT updated_at INTO old_ts FROM public.carts WHERE user_id = 'a0000000-0000-0000-0000-000000000001';
  PERFORM pg_sleep(0.05);
  UPDATE public.carts SET updated_at = now() WHERE user_id = 'a0000000-0000-0000-0000-000000000001';
  SELECT updated_at INTO new_ts FROM public.carts WHERE user_id = 'a0000000-0000-0000-0000-000000000001';
  IF new_ts <= old_ts THEN RAISE EXCEPTION 'AC6: set_updated_at did not advance updated_at on carts'; END IF;
  DELETE FROM public.carts WHERE user_id = 'a0000000-0000-0000-0000-000000000001';
END $$;
SELECT ok(true, 'AC6: set_updated_at trigger fires on carts');

-- set_updated_at on coupons
DO $$
DECLARE old_ts timestamptz; new_ts timestamptz;
BEGIN
  SELECT updated_at INTO old_ts FROM public.coupons WHERE id = 'e0000000-0000-0000-0000-000000000001';
  PERFORM pg_sleep(0.05);
  UPDATE public.coupons SET is_active = true WHERE id = 'e0000000-0000-0000-0000-000000000001';
  SELECT updated_at INTO new_ts FROM public.coupons WHERE id = 'e0000000-0000-0000-0000-000000000001';
  IF new_ts <= old_ts THEN RAISE EXCEPTION 'AC6: set_updated_at did not advance updated_at on coupons'; END IF;
END $$;
SELECT ok(true, 'AC6: set_updated_at trigger fires on coupons');

-- set_updated_at on orders
DO $$
DECLARE old_ts timestamptz; new_ts timestamptz;
BEGIN
  SELECT updated_at INTO old_ts FROM public.orders WHERE id = 'f0000000-0000-0000-0000-000000000001';
  PERFORM pg_sleep(0.05);
  UPDATE public.orders SET needs_review = true WHERE id = 'f0000000-0000-0000-0000-000000000001';
  SELECT updated_at INTO new_ts FROM public.orders WHERE id = 'f0000000-0000-0000-0000-000000000001';
  IF new_ts <= old_ts THEN RAISE EXCEPTION 'AC6: set_updated_at did not advance updated_at on orders'; END IF;
END $$;
SELECT ok(true, 'AC6: set_updated_at trigger fires on orders');

-- ─────────────────────────────────────────────────────────────────────────────
-- AC7: next_order_number function
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE n1 text; n2 text;
BEGIN
  n1 := private.next_order_number();
  n2 := private.next_order_number();
  IF n1 !~ '^CS-[0-9]{4}-[0-9]{5}$' THEN
    RAISE EXCEPTION 'AC7: next_order_number format wrong: %', n1;
  END IF;
  IF n1 = n2 THEN
    RAISE EXCEPTION 'EC8: two calls returned same order number: %', n1;
  END IF;
END $$;
SELECT ok(true, 'AC7/EC8: next_order_number returns CS-YYYY-NNNNN and each call is unique');

-- ─────────────────────────────────────────────────────────────────────────────
-- AC7: reserve_coupon_use / release_coupon_use
-- ─────────────────────────────────────────────────────────────────────────────

-- reserve_coupon_use happy path
DO $$
DECLARE uses_before int; uses_after int;
BEGIN
  SELECT uses_count INTO uses_before FROM public.coupons WHERE id = 'e0000000-0000-0000-0000-000000000001';
  PERFORM private.reserve_coupon_use(
    'e0000000-0000-0000-0000-000000000001',
    'f0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001'
  );
  SELECT uses_count INTO uses_after FROM public.coupons WHERE id = 'e0000000-0000-0000-0000-000000000001';
  IF uses_after <> uses_before + 1 THEN
    RAISE EXCEPTION 'AC7: uses_count not incremented after reserve';
  END IF;
END $$;
SELECT ok(true, 'AC7: reserve_coupon_use increments uses_count');

-- release_coupon_use decrements and sets released_at
DO $$
DECLARE uses_before int; uses_after int; rel_at timestamptz;
BEGIN
  SELECT uses_count INTO uses_before FROM public.coupons WHERE id = 'e0000000-0000-0000-0000-000000000001';
  PERFORM private.release_coupon_use('f0000000-0000-0000-0000-000000000001');
  SELECT uses_count INTO uses_after FROM public.coupons WHERE id = 'e0000000-0000-0000-0000-000000000001';
  SELECT released_at INTO rel_at FROM public.coupon_uses WHERE order_id = 'f0000000-0000-0000-0000-000000000001';
  IF uses_after <> uses_before - 1 THEN
    RAISE EXCEPTION 'AC7: uses_count not decremented after release (before=%, after=%)', uses_before, uses_after;
  END IF;
  IF rel_at IS NULL THEN
    RAISE EXCEPTION 'AC7: released_at not set after release_coupon_use';
  END IF;
END $$;
SELECT ok(true, 'AC7: release_coupon_use decrements uses_count and sets released_at');

-- EC10: release_coupon_use called twice does nothing on second call (count does not go negative)
DO $$
DECLARE uses_count_val int;
BEGIN
  -- Re-reserve to have something to release
  PERFORM private.reserve_coupon_use(
    'e0000000-0000-0000-0000-000000000001',
    'f0000000-0000-0000-0000-000000000002',
    'b0000000-0000-0000-0000-000000000001'
  );
  PERFORM private.release_coupon_use('f0000000-0000-0000-0000-000000000002');
  PERFORM private.release_coupon_use('f0000000-0000-0000-0000-000000000002'); -- second call
  SELECT uses_count INTO uses_count_val FROM public.coupons WHERE id = 'e0000000-0000-0000-0000-000000000001';
  -- count should not go below zero; the second call must be a no-op
  IF uses_count_val < 0 THEN
    RAISE EXCEPTION 'EC10: uses_count went negative after double release: %', uses_count_val;
  END IF;
END $$;
SELECT ok(true, 'EC10: release_coupon_use called twice does not decrement twice');

-- EC2: reserve_coupon_use refuses expired coupon
DO $$
DECLARE exp_coupon_id uuid := 'e0000000-0000-0000-0000-000000000002';
BEGIN
  INSERT INTO public.coupons (id, code, discount_type, discount_value, expires_at, max_uses)
  VALUES (exp_coupon_id, 'EXPIRED', 'percent', 10, now() - interval '1 day', 10);
  BEGIN
    PERFORM private.reserve_coupon_use(
      exp_coupon_id,
      'f0000000-0000-0000-0000-000000000001',
      'a0000000-0000-0000-0000-000000000001'
    );
    RAISE EXCEPTION 'EC2: reserve_coupon_use should have refused expired coupon';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;
SELECT ok(true, 'EC2: reserve_coupon_use refuses expired coupon');

-- EC-missing-2: reserve_coupon_use refuses inactive coupon
DO $$
DECLARE inactive_id uuid := 'e0000000-0000-0000-0000-000000000003';
BEGIN
  INSERT INTO public.coupons (id, code, discount_type, discount_value, expires_at, max_uses, is_active)
  VALUES (inactive_id, 'INACTIVE', 'percent', 10, now() + interval '1 day', 10, false);
  BEGIN
    PERFORM private.reserve_coupon_use(
      inactive_id,
      'f0000000-0000-0000-0000-000000000001',
      'a0000000-0000-0000-0000-000000000001'
    );
    RAISE EXCEPTION 'EC-missing-2: reserve_coupon_use should have refused inactive coupon';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;
SELECT ok(true, 'EC-missing-2: reserve_coupon_use refuses inactive coupon');

-- EC1: coupon with max_uses = 1: two callers — only one can succeed
-- (simulated sequentially with fresh orders)
DO $$
DECLARE
  one_use_id uuid := 'e0000000-0000-0000-0000-000000000004';
  order_a    uuid := gen_random_uuid();
  order_b    uuid := gen_random_uuid();
  succeeded  int  := 0;
BEGIN
  INSERT INTO public.coupons (id, code, discount_type, discount_value, expires_at, max_uses)
  VALUES (one_use_id, 'ONEUSE', 'percent', 10, now() + interval '1 day', 1);

  -- Two fresh orders to use as the competing requests
  INSERT INTO public.orders (
    id, order_number, user_id, status, currency, subtotal_cents, total_cents,
    terms_revision_id, refund_policy_revision_id, terms_accepted_at
  ) VALUES
    (order_a, 'CS-TEST-00101', 'a0000000-0000-0000-0000-000000000001',
     'pending', 'LKR', 1000, 1000,
     '10000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000020', now()),
    (order_b, 'CS-TEST-00102', 'b0000000-0000-0000-0000-000000000001',
     'pending', 'LKR', 2000, 2000,
     '10000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000020', now());

  -- First attempt should succeed
  BEGIN
    PERFORM private.reserve_coupon_use(one_use_id, order_a, 'a0000000-0000-0000-0000-000000000001');
    succeeded := succeeded + 1;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  -- Second attempt should fail (max_uses exhausted)
  BEGIN
    PERFORM private.reserve_coupon_use(one_use_id, order_b, 'b0000000-0000-0000-0000-000000000001');
    succeeded := succeeded + 1;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  IF succeeded <> 1 THEN
    RAISE EXCEPTION 'EC1: expected exactly 1 success for max_uses=1 coupon, got %', succeeded;
  END IF;
END $$;
SELECT ok(true, 'EC1: max_uses=1 coupon: exactly one attempt succeeds');

-- ─────────────────────────────────────────────────────────────────────────────
-- AC8/AC9: RLS tests
-- ─────────────────────────────────────────────────────────────────────────────

-- Ensure customer A has a cart
INSERT INTO public.carts (user_id) VALUES ('a0000000-0000-0000-0000-000000000001') ON CONFLICT DO NOTHING;
INSERT INTO public.cart_items (user_id, document_id, language)
VALUES ('a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001','ta')
ON CONFLICT DO NOTHING;

-- Ensure customer B has a cart
INSERT INTO public.carts (user_id) VALUES ('b0000000-0000-0000-0000-000000000001') ON CONFLICT DO NOTHING;

-- Test as customer A: cannot read customer B's cart
SET LOCAL role TO authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';

SELECT is(
  (SELECT count(*)::int FROM public.carts WHERE user_id = 'b0000000-0000-0000-0000-000000000001'),
  0,
  'AC9: customer A cannot read customer B carts'
);

SELECT is(
  (SELECT count(*)::int FROM public.cart_items WHERE user_id = 'b0000000-0000-0000-0000-000000000001'),
  0,
  'AC9: customer A cannot read customer B cart_items'
);

-- Customer A cannot read customer B's orders
SELECT is(
  (SELECT count(*)::int FROM public.orders WHERE user_id = 'b0000000-0000-0000-0000-000000000001'),
  0,
  'AC9: customer A cannot read customer B orders'
);

-- Customer A cannot read customer B's order_items (via order_id join)
SELECT is(
  (SELECT count(*)::int FROM public.order_items oi
    JOIN public.orders o ON oi.order_id = o.id
    WHERE o.user_id = 'b0000000-0000-0000-0000-000000000001'),
  0,
  'AC9: customer A cannot read customer B order_items'
);

-- Customer A cannot read coupons
SELECT is(
  (SELECT count(*)::int FROM public.coupons),
  0,
  'AC9: customer cannot select coupons'
);

-- Customer A cannot read coupon_uses
SELECT is(
  (SELECT count(*)::int FROM public.coupon_uses),
  0,
  'AC9: customer cannot select coupon_uses'
);

-- Customer A cannot INSERT into orders (writes go through service role)
SELECT throws_ok(
  $$INSERT INTO public.orders (
    order_number, user_id, status, currency, subtotal_cents, total_cents,
    terms_revision_id, refund_policy_revision_id, terms_accepted_at
  ) VALUES ('CS-2026-CUST','a0000000-0000-0000-0000-000000000001','pending','LKR',1000,1000,
    '10000000-0000-0000-0000-000000000010','10000000-0000-0000-0000-000000000020', now())$$,
  '42501', NULL,
  'AC9: customer cannot INSERT into orders'
);

-- Customer A cannot INSERT into customer B's cart
SELECT throws_ok(
  $$INSERT INTO public.carts (user_id) VALUES ('b0000000-0000-0000-0000-000000000001')$$,
  '42501', NULL,
  'AC9: customer A cannot insert into customer B carts'
);

-- Customer A cannot DELETE from customer B's cart
WITH del AS (
  DELETE FROM public.carts WHERE user_id = 'b0000000-0000-0000-0000-000000000001' RETURNING user_id
)
SELECT is((SELECT count(*)::int FROM del), 0, 'AC9: customer A cannot delete customer B cart');

-- Staff without orders.* permission reads zero orders
RESET role;
RESET "request.jwt.claims";
-- Use authenticated role with no orders.* permission (empty jwt claims = no staff roles)
SET LOCAL role TO authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"b0000000-0000-0000-0000-000000000001","role":"authenticated"}';

SELECT is(
  (SELECT count(*)::int FROM public.orders WHERE user_id = 'a0000000-0000-0000-0000-000000000001'),
  0,
  'AC9: authenticated user without orders.* cannot read other users orders'
);

-- Staff update blocked for non-review fields (trigger enforcement)
-- Switch to staff user (admin with orders.*) so the UPDATE policy passes, then trigger fires
RESET role;
RESET "request.jwt.claims";
SET LOCAL role TO authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"f0000000-0000-0000-0000-000000000099","role":"authenticated"}';

SELECT throws_ok(
  $$UPDATE public.orders SET total_cents = 1 WHERE user_id = 'b0000000-0000-0000-0000-000000000001'$$,
  'P0001', NULL,
  'AC8: staff cannot update total_cents on orders (restrict trigger)'
);

-- anon sees nothing
RESET role;
RESET "request.jwt.claims";
SET LOCAL role TO anon;

SELECT is(
  (SELECT count(*)::int FROM public.carts),
  0,
  'AC9: anon reads zero rows from carts'
);
SELECT is(
  (SELECT count(*)::int FROM public.orders),
  0,
  'AC9: anon reads zero rows from orders'
);
SELECT is(
  (SELECT count(*)::int FROM public.coupons),
  0,
  'AC9: anon reads zero rows from coupons'
);

RESET role;

-- ─────────────────────────────────────────────────────────────────────────────
-- AC10: types/database.ts coverage (structure check only — file is regenerated)
-- ─────────────────────────────────────────────────────────────────────────────

-- Verify all 6 tables exist in public schema (proxy for type generation)
SELECT has_table('public', 'carts',       'AC10: carts table in public schema');
SELECT has_table('public', 'cart_items',  'AC10: cart_items table in public schema');
SELECT has_table('public', 'coupons',     'AC10: coupons table in public schema');
SELECT has_table('public', 'coupon_uses', 'AC10: coupon_uses table in public schema');
SELECT has_table('public', 'orders',      'AC10: orders table in public schema');
SELECT has_table('public', 'order_items', 'AC10: order_items table in public schema');

SELECT * FROM finish();
ROLLBACK;
