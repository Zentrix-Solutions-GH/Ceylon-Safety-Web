-- S-021: RLS verification suite + CI check
-- Whole-schema safety and completeness: table count, RLS enabled, access matrix,
-- function exposure, append-only regressions, FK index coverage.
-- Run with: supabase test db
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;
SELECT * FROM no_plan();

-- ─────────────────────────────────────────────────────────────────────────────
-- Fixtures  (UUID prefix: 021 — no collision with other test files)
-- All data is created inside this transaction; ROLLBACK at the end.
-- ─────────────────────────────────────────────────────────────────────────────

-- Pages + revisions (FK required by several tables)
INSERT INTO public.pages (id, slug, title)
VALUES
  ('02100010-0000-0000-0000-000000000001', 'terms-s021',  'Terms S021'),
  ('02100010-0000-0000-0000-000000000002', 'refund-s021', 'Refund S021')
ON CONFLICT DO NOTHING;

INSERT INTO public.page_revisions (id, page_id, version, published_at)
VALUES
  ('02100011-0000-0000-0000-000000000001', '02100010-0000-0000-0000-000000000001', 1, now()),
  ('02100011-0000-0000-0000-000000000002', '02100010-0000-0000-0000-000000000002', 1, now())
ON CONFLICT DO NOTHING;

-- Profiles
INSERT INTO public.profiles (id, display_name, email, status)
VALUES
  ('02100001-0000-0000-0000-000000000001', 'SA S021',       'sa.s021@test.invalid',    'active'),
  ('02100001-0000-0000-0000-000000000002', 'Admin S021',    'admin.s021@test.invalid',  'active'),
  ('02100001-0000-0000-0000-000000000003', 'Maint S021',    'maint.s021@test.invalid',  'active'),
  ('02100001-0000-0000-0000-000000000004', 'CustA S021',    'custa.s021@test.invalid',  'active'),
  ('02100001-0000-0000-0000-000000000005', 'CustB S021',    'custb.s021@test.invalid',  'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role, granted_by)
VALUES
  ('02100001-0000-0000-0000-000000000001', 'super_admin', '02100001-0000-0000-0000-000000000001'),
  ('02100001-0000-0000-0000-000000000002', 'admin',       '02100001-0000-0000-0000-000000000001'),
  ('02100001-0000-0000-0000-000000000003', 'maintainer',  '02100001-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- Give admin orders.*, coupons.*, media.upload so access-matrix tests have real
-- rows to assert on; Maintainer gets zero rows (deny by default, no role_permissions).
INSERT INTO public.role_permissions (role, action)
VALUES
  ('admin', 'orders.*'),
  ('admin', 'coupons.*'),
  ('admin', 'media.upload'),
  ('admin', 'audit.read'),
  ('admin', 'settings.site')
ON CONFLICT DO NOTHING;

-- Category
INSERT INTO public.categories (id, slug, name, applies_to)
VALUES ('02100002-0000-0000-0000-000000000001', 's021-cat', 'S021 Cat', ARRAY['article','document'])
ON CONFLICT (id) DO NOTHING;

-- Document + document_file (required for entitlements / download tests)
INSERT INTO public.documents (id, slug, title, doc_kind, price_cents, status, published_at, category_id)
VALUES ('02100003-0000-0000-0000-000000000001', 's021-doc', 'S021 Doc', 'checklist', 500, 'published', now(), '02100002-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.document_files (id, document_id, kind, language, format, file_key, size_bytes, status, is_current)
VALUES ('02100003-0000-0000-0000-000000000010', '02100003-0000-0000-0000-000000000001', 'full', 'en', 'pptx', 'docs/s021/en/v1/file.pptx', 1024, 'ready', true)
ON CONFLICT DO NOTHING;

-- Order + order_item + entitlement for CustA
INSERT INTO public.orders (
  id, user_id, status, payment_provider,
  currency, subtotal_cents, total_cents,
  order_number, terms_revision_id, refund_policy_revision_id,
  terms_accepted_at, paid_at
)
VALUES (
  '02100004-0000-0000-0000-000000000001',
  '02100001-0000-0000-0000-000000000004',
  'paid', 'payhere',
  'LKR', 500, 500,
  'S021-0001',
  '02100011-0000-0000-0000-000000000001',
  '02100011-0000-0000-0000-000000000002',
  now(), now()
) ON CONFLICT DO NOTHING;

INSERT INTO public.order_items (
  id, order_id, item_type, document_id, language,
  title_snapshot, unit_price_cents, line_total_cents
)
VALUES (
  '02100004-0000-0000-0000-000000000010',
  '02100004-0000-0000-0000-000000000001',
  'document',
  '02100003-0000-0000-0000-000000000001',
  'en', 'S021 Doc', 500, 500
) ON CONFLICT DO NOTHING;

INSERT INTO public.entitlements (
  id, user_id, item_type, order_item_id, document_id, language, source, download_limit, downloads_used
)
VALUES (
  '02100005-0000-0000-0000-000000000001',
  '02100001-0000-0000-0000-000000000004',
  'document',
  '02100004-0000-0000-0000-000000000010',
  '02100003-0000-0000-0000-000000000001',
  'en', 'purchase', 1, 0
) ON CONFLICT DO NOTHING;

-- Cart for CustA (PK is user_id, no separate id column)
INSERT INTO public.carts (user_id)
VALUES ('02100001-0000-0000-0000-000000000004')
ON CONFLICT DO NOTHING;

-- Order + order_item + entitlement + bank_transfer_slip + download_request for CustB
-- (needed so AC3 cross-user isolation tests have real CustB rows to assert on)
INSERT INTO public.orders (
  id, user_id, status, payment_provider,
  currency, subtotal_cents, total_cents,
  order_number, terms_revision_id, refund_policy_revision_id,
  terms_accepted_at
)
VALUES (
  '02100004-0000-0000-0000-000000000002',
  '02100001-0000-0000-0000-000000000005',
  'pending', 'bank_transfer',
  'LKR', 500, 500,
  'S021-0002',
  '02100011-0000-0000-0000-000000000001',
  '02100011-0000-0000-0000-000000000002',
  now()
) ON CONFLICT DO NOTHING;

INSERT INTO public.order_items (
  id, order_id, item_type, document_id, language,
  title_snapshot, unit_price_cents, line_total_cents
)
VALUES (
  '02100004-0000-0000-0000-000000000020',
  '02100004-0000-0000-0000-000000000002',
  'document',
  '02100003-0000-0000-0000-000000000001',
  'en', 'S021 Doc', 500, 500
) ON CONFLICT DO NOTHING;

INSERT INTO public.entitlements (
  id, user_id, item_type, order_item_id, document_id, language, source, download_limit, downloads_used
)
VALUES (
  '02100005-0000-0000-0000-000000000002',
  '02100001-0000-0000-0000-000000000005',
  'document',
  '02100004-0000-0000-0000-000000000020',
  '02100003-0000-0000-0000-000000000001',
  'en', 'purchase', 1, 0
) ON CONFLICT DO NOTHING;

INSERT INTO public.bank_transfer_slips (
  id, order_id, uploaded_by, file_key, mime_type, size_bytes, status
)
VALUES (
  '02100006-0000-0000-0000-000000000001',
  '02100004-0000-0000-0000-000000000002',
  '02100001-0000-0000-0000-000000000005',
  'slips/s021/custb/slip1.jpg', 'image/jpeg', 4096, 'uploaded'
) ON CONFLICT DO NOTHING;

INSERT INTO public.download_requests (
  id, entitlement_id, user_id, note, status
)
VALUES (
  '02100007-0000-0000-0000-000000000001',
  '02100005-0000-0000-0000-000000000002',
  '02100001-0000-0000-0000-000000000005',
  'Please approve', 'open'
) ON CONFLICT DO NOTHING;

-- Article + video for CustB likes/comments
INSERT INTO public.articles (id, slug, title, status, body_text, published_at)
VALUES ('02100008-0000-0000-0000-000000000001', 's021-article', 'S021 Article', 'published', 'test', now())
ON CONFLICT DO NOTHING;

INSERT INTO public.videos (id, youtube_id, title, thumbnail_key, status, published_at)
VALUES ('02100009-0000-0000-0000-000000000001', 'S021test123', 'S021 Video', 'videos/s021/thumb.jpg', 'published', now())
ON CONFLICT DO NOTHING;

-- article_like and video_like for CustB
INSERT INTO public.article_likes (article_id, user_id)
VALUES ('02100008-0000-0000-0000-000000000001', '02100001-0000-0000-0000-000000000005')
ON CONFLICT DO NOTHING;

INSERT INTO public.video_likes (video_id, user_id)
VALUES ('02100009-0000-0000-0000-000000000001', '02100001-0000-0000-0000-000000000005')
ON CONFLICT DO NOTHING;

-- article_comment and video_comment for CustB
INSERT INTO public.article_comments (id, article_id, user_id, body, status)
VALUES ('02100008-0000-0000-0000-000000000010', '02100008-0000-0000-0000-000000000001',
        '02100001-0000-0000-0000-000000000005', 'CustB comment', 'pending')
ON CONFLICT DO NOTHING;

INSERT INTO public.video_comments (id, video_id, user_id, body, status)
VALUES ('02100009-0000-0000-0000-000000000010', '02100009-0000-0000-0000-000000000001',
        '02100001-0000-0000-0000-000000000005', 'CustB video comment', 'pending')
ON CONFLICT DO NOTHING;

-- Admin audit log row (actor = admin user, NOT super admin)
INSERT INTO public.admin_audit_log (actor_id, action, entity_type, entity_id)
VALUES (
  '02100001-0000-0000-0000-000000000002',
  'order.grant',
  'order',
  '02100004-0000-0000-0000-000000000001'
);

-- Admin audit log row whose actor is the Super Admin (hidden from non-SA staff)
INSERT INTO public.admin_audit_log (actor_id, action, entity_type, entity_id)
VALUES (
  '02100001-0000-0000-0000-000000000001',
  'role.change',
  'user_roles',
  '02100001-0000-0000-0000-000000000002'
);

-- Site settings row for regression test (only needs one row; seed may already have them)
INSERT INTO public.site_settings (key, value, setting_group, is_public)
VALUES ('s021_test_key', '"test"', 'site', false)
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- AC1: Table-count check
-- 37 mandatory application tables must exist; 6 must NOT exist.
-- training_programs is optional (Q74) and must NOT exist in v1.
-- Views are excluded from this count (they are not tables in pg_class.relkind='r').
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  expected_tables text[] := ARRAY[
    'profiles', 'user_roles', 'role_permissions',
    'categories', 'authors', 'media_assets', 'site_settings',
    'pages', 'page_revisions', 'slug_redirects',
    'articles', 'article_refs', 'article_likes', 'article_comments',
    'videos', 'video_likes', 'video_comments',
    'documents', 'document_files',
    'carts', 'cart_items', 'coupons', 'coupon_uses',
    'orders', 'order_items',
    'payment_events', 'bank_transfer_slips', 'entitlements',
    'download_logs', 'download_requests', 'invoices', 'email_logs',
    'courses', 'trainers', 'activity_images', 'banners',
    'admin_audit_log'
  ];
  t text;
  actual_count int;
BEGIN
  -- Each expected table must exist
  FOREACH t IN ARRAY expected_tables LOOP
    ASSERT (
      SELECT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = t AND c.relkind = 'r'
      )
    ), format('AC1: expected table public.%s not found', t);
  END LOOP;

  -- Exact count of ordinary tables in public schema
  SELECT COUNT(*) INTO actual_count
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r';

  ASSERT actual_count = 37,
    format('AC1: expected 37 tables in public schema, found %s', actual_count);
END;
$$;

SELECT pass('AC1: all 37 mandatory tables present and count is exact');

DO $$
  DECLARE t text;
  DECLARE absent_tables text[] := ARRAY[
    'enquiries', 'refunds', 'discount_tiers',
    'article_sections', 'article_document_links', 'banner_clicks',
    'training_programs'
  ];
BEGIN
  FOREACH t IN ARRAY absent_tables LOOP
    ASSERT (
      SELECT NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = t AND c.relkind = 'r'
      )
    ), format('AC1: table public.%s must not exist in v1', t);
  END LOOP;
END;
$$;

SELECT pass('AC1: all 7 forbidden tables absent');

-- ─────────────────────────────────────────────────────────────────────────────
-- AC2: RLS enabled on every table in public schema
-- Views (relkind='v' or 'm') are excluded — Postgres does not allow RLS on views.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relrowsecurity = false
  LOOP
    RAISE EXCEPTION 'AC2: table % has RLS DISABLED — add ENABLE ROW LEVEL SECURITY', r.relname;
  END LOOP;
END;
$$;

SELECT pass('AC2: RLS enabled on every table in public schema');

-- ─────────────────────────────────────────────────────────────────────────────
-- AC3 / AC4: Access matrix
-- anon and customer see zero rows from private-data tables.
-- Customer A cannot read Customer B's private rows.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── anon: private tables return zero rows (or permission denied = also blocked) ──
-- Helper: returns 0 if the table is accessible but empty for this role,
-- or -1 if SELECT is revoked (permission denied is also acceptable blocking).

SET LOCAL role TO anon;

DO $$
DECLARE
  v_count int;
  tables_to_check text[] := ARRAY[
    'document_files', 'payment_events', 'email_logs', 'admin_audit_log',
    'coupons', 'coupon_uses', 'role_permissions', 'user_roles',
    'media_assets', 'article_refs', 'profiles',
    'orders', 'invoices', 'entitlements', 'download_logs',
    'download_requests', 'bank_transfer_slips', 'carts', 'cart_items'
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY tables_to_check LOOP
    BEGIN
      EXECUTE format('SELECT COUNT(*)::int FROM public.%I', t) INTO v_count;
      ASSERT v_count = 0,
        format('AC4: anon sees %s rows in %s (expected 0)', v_count, t);
    EXCEPTION WHEN insufficient_privilege THEN
      -- REVOKE SELECT is also acceptable protection — the table is blocked.
      NULL;
    END;
  END LOOP;
END;
$$;

SELECT pass('AC4: anon cannot access private tables (0 rows or permission denied)');

RESET role;

-- ── Customer A: reads own rows, cannot read Customer B's rows ─────────────────

SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"02100001-0000-0000-0000-000000000004","role":"authenticated"}';

-- Customer A can see own profile
SELECT ok(
  (SELECT COUNT(*)::int FROM public.profiles WHERE id = '02100001-0000-0000-0000-000000000004') = 1,
  'AC3: customer A reads own profile'
);
-- Customer A cannot read Customer B's profile
SELECT is(
  (SELECT COUNT(*)::int FROM public.profiles WHERE id = '02100001-0000-0000-0000-000000000005'),
  0, 'AC3: customer A cannot read customer B profile'
);
-- Customer A reads own orders
SELECT ok(
  (SELECT COUNT(*)::int FROM public.orders WHERE user_id = '02100001-0000-0000-0000-000000000004') >= 1,
  'AC3: customer A reads own orders'
);
-- Customer A cannot see orders belonging to other users
SELECT is(
  (SELECT COUNT(*)::int FROM public.orders WHERE user_id != '02100001-0000-0000-0000-000000000004'),
  0, 'AC3: customer A cannot read other user orders'
);
-- Customer A reads own cart
SELECT ok(
  (SELECT COUNT(*)::int FROM public.carts WHERE user_id = '02100001-0000-0000-0000-000000000004') >= 1,
  'AC3: customer A reads own cart'
);
-- Customer A cannot see carts not belonging to them
SELECT is(
  (SELECT COUNT(*)::int FROM public.carts WHERE user_id != '02100001-0000-0000-0000-000000000004'),
  0, 'AC3: customer A cannot read other user carts'
);
-- Customer A reads own entitlements
SELECT ok(
  (SELECT COUNT(*)::int FROM public.entitlements WHERE user_id = '02100001-0000-0000-0000-000000000004') >= 1,
  'AC3: customer A reads own entitlements'
);
-- Customer A cannot see other users' entitlements
SELECT is(
  (SELECT COUNT(*)::int FROM public.entitlements WHERE user_id != '02100001-0000-0000-0000-000000000004'),
  0, 'AC3: customer A cannot read other user entitlements'
);
-- Customer A reads own invoices (invoices linked to own orders)
SELECT is(
  (SELECT COUNT(*)::int FROM public.invoices
   WHERE order_id NOT IN (
     SELECT id FROM public.orders WHERE user_id = '02100001-0000-0000-0000-000000000004'
   )),
  0, 'AC3: customer A cannot read other user invoices'
);
-- Customer A reads own download_logs
SELECT is(
  (SELECT COUNT(*)::int FROM public.download_logs WHERE user_id != '02100001-0000-0000-0000-000000000004'),
  0, 'AC3: customer A cannot read other user download_logs'
);
-- cart_items: CustA cannot see CustB cart items (user_id is the FK to carts)
SELECT is(
  (SELECT COUNT(*)::int FROM public.cart_items
   WHERE user_id != '02100001-0000-0000-0000-000000000004'),
  0, 'AC3: customer A cannot read other user cart_items'
);
-- order_items: CustA cannot see CustB order items
SELECT is(
  (SELECT COUNT(*)::int FROM public.order_items
   WHERE order_id NOT IN (SELECT id FROM public.orders WHERE user_id = '02100001-0000-0000-0000-000000000004')),
  0, 'AC3: customer A cannot read other user order_items'
);
-- bank_transfer_slips: CustA cannot see CustB slips
SELECT is(
  (SELECT COUNT(*)::int FROM public.bank_transfer_slips
   WHERE order_id NOT IN (SELECT id FROM public.orders WHERE user_id = '02100001-0000-0000-0000-000000000004')),
  0, 'AC3: customer A cannot read other user bank_transfer_slips'
);
-- download_requests: CustA cannot see CustB requests
SELECT is(
  (SELECT COUNT(*)::int FROM public.download_requests WHERE user_id != '02100001-0000-0000-0000-000000000004'),
  0, 'AC3: customer A cannot read other user download_requests'
);
-- article_comments: CustA cannot see CustB pending comments (own pending only)
SELECT is(
  (SELECT COUNT(*)::int FROM public.article_comments
   WHERE user_id != '02100001-0000-0000-0000-000000000004' AND status = 'pending'),
  0, 'AC3: customer A cannot read other user pending article_comments'
);
-- video_comments: CustA cannot see CustB pending comments
SELECT is(
  (SELECT COUNT(*)::int FROM public.video_comments
   WHERE user_id != '02100001-0000-0000-0000-000000000004' AND status = 'pending'),
  0, 'AC3: customer A cannot read other user pending video_comments'
);
-- article_likes: CustA cannot see CustB likes
SELECT is(
  (SELECT COUNT(*)::int FROM public.article_likes
   WHERE user_id != '02100001-0000-0000-0000-000000000004'),
  0, 'AC3: customer A cannot read other user article_likes'
);
-- video_likes: CustA cannot see CustB likes
SELECT is(
  (SELECT COUNT(*)::int FROM public.video_likes
   WHERE user_id != '02100001-0000-0000-0000-000000000004'),
  0, 'AC3: customer A cannot read other user video_likes'
);
-- Customers get 0 rows from private tables regardless of JWT
DO $$
DECLARE
  v_count int;
  private_tables text[] := ARRAY[
    'document_files', 'payment_events', 'email_logs', 'admin_audit_log',
    'coupons', 'coupon_uses', 'media_assets', 'role_permissions', 'user_roles', 'article_refs'
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY private_tables LOOP
    BEGIN
      EXECUTE format('SELECT COUNT(*)::int FROM public.%I', t) INTO v_count;
      ASSERT v_count = 0,
        format('AC4: authenticated customer sees %s rows in %s (expected 0)', v_count, t);
    EXCEPTION WHEN insufficient_privilege THEN
      NULL; -- REVOKE SELECT is also acceptable.
    END;
  END LOOP;
END;
$$;

SELECT pass('AC4: authenticated customer cannot access private tables');

RESET role;

-- ── Maintainer: no permissions → zero rows from staff-only tables ─────────────

SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"02100001-0000-0000-0000-000000000003","role":"authenticated"}';

SELECT is(
  (SELECT COUNT(*)::int FROM public.admin_audit_log),
  0, 'AC3: maintainer (no permissions) gets 0 rows from admin_audit_log'
);
SELECT is(
  (SELECT COUNT(*)::int FROM public.coupons),
  0, 'AC3: maintainer gets 0 rows from coupons'
);
SELECT is(
  (SELECT COUNT(*)::int FROM public.payment_events),
  0, 'AC3: maintainer gets 0 rows from payment_events'
);

RESET role;

-- ── Admin: sees audit log but NOT rows for super admin actor ─────────────────

SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"02100001-0000-0000-0000-000000000002","role":"authenticated"}';

-- Admin with audit.read can see audit rows for non-SA actors
SELECT ok(
  (SELECT COUNT(*)::int FROM public.admin_audit_log
   WHERE actor_id = '02100001-0000-0000-0000-000000000002') >= 1,
  'AC3: admin reads audit rows where actor is non-SA'
);
-- Admin cannot see audit rows for the Super Admin actor (REQ-130c regression)
SELECT is(
  (SELECT COUNT(*)::int FROM public.admin_audit_log
   WHERE actor_id = '02100001-0000-0000-0000-000000000001'),
  0, 'AC3 / REQ-130c: admin cannot read audit rows for super admin actor'
);

RESET role;

-- ── Super Admin: sees all audit rows including SA actor rows ─────────────────

SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"02100001-0000-0000-0000-000000000001","role":"authenticated"}';

SELECT ok(
  (SELECT COUNT(*)::int FROM public.admin_audit_log) >= 2,
  'AC3: super admin sees all audit rows including SA actor rows'
);

RESET role;

-- ─────────────────────────────────────────────────────────────────────────────
-- AC5: Function exposure
-- EXECUTE revoked from public / anon / authenticated for every function in
-- public and private schemas, EXCEPT: has_permission, is_staff_member, is_super_admin.
-- (search_all is skipped until S-064 exists.)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  r        record;
  -- profile_is_super_admin is whitelisted: authenticated needs EXECUTE for RLS
  -- policies on profiles/admin_audit_log; it is SECURITY DEFINER and returns only boolean.
  whitelisted_public text[] := ARRAY['has_permission','is_staff_member','is_super_admin','profile_is_super_admin'];
  fn_sig   text;
  has_pub  boolean;
  has_anon boolean;
  has_auth boolean;
BEGIN
  FOR r IN
    SELECT p.proname, n.nspname, oidvectortypes(p.proargtypes) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('public', 'private')
      -- Skip trigger functions: they are callable only by the trigger mechanism,
      -- not directly, so has_function_privilege always returns true.
      AND p.prorettype <> 'trigger'::regtype::oid
      -- Skip extension-owned functions (pg_trgm, pg_stat_statements, etc.)
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.classid = 'pg_proc'::regclass
          AND d.objid = p.oid
          AND d.deptype = 'e'
      )
  LOOP
    -- Skip whitelisted public functions
    IF r.nspname = 'public' AND r.proname = ANY(whitelisted_public) THEN
      CONTINUE;
    END IF;
    -- Skip search_all if it does not exist yet (S-064)
    IF r.nspname = 'public' AND r.proname = 'search_all' THEN
      CONTINUE;
    END IF;

    fn_sig := format('%s.%s(%s)', r.nspname, r.proname, r.args);

    SELECT has_function_privilege('anon', fn_sig, 'EXECUTE')      INTO has_anon;
    SELECT has_function_privilege('authenticated', fn_sig, 'EXECUTE') INTO has_auth;

    ASSERT NOT has_anon,
      format('AC5: anon must not EXECUTE %s', fn_sig);
    ASSERT NOT has_auth,
      format('AC5: authenticated must not EXECUTE %s', fn_sig);

    -- public role check (catches future GRANT to PUBLIC)
    BEGIN
      SELECT has_function_privilege('public', fn_sig, 'EXECUTE') INTO has_pub;
      ASSERT NOT has_pub,
        format('AC5: public must not EXECUTE %s', fn_sig);
    EXCEPTION WHEN OTHERS THEN
      NULL; -- public role has no privilege entry = fine
    END;
  END LOOP;
END;
$$;

SELECT pass('AC5: EXECUTE revoked from anon/authenticated for all non-whitelisted functions');

-- ── Whitelisted functions are callable by anon and authenticated ──────────────

SET LOCAL role TO anon;
SELECT ok(
  (SELECT public.is_staff_member()) IS NOT NULL,
  'AC5: anon can EXECUTE public.is_staff_member()'
);
SELECT ok(
  (SELECT public.is_super_admin()) IS NOT NULL,
  'AC5: anon can EXECUTE public.is_super_admin()'
);
SELECT ok(
  (SELECT public.has_permission('some.action')) IS NOT NULL,
  'AC5: anon can EXECUTE public.has_permission(text)'
);
-- profile_is_super_admin: anon must not execute it directly even though it is
-- in the whitelist (the loop skips it; this assertion confirms the migration sticks).
SELECT throws_ok(
  $$SELECT public.profile_is_super_admin('00000000-0000-0000-0000-000000000000'::uuid)$$,
  '42501',
  NULL,
  'AC5: anon cannot EXECUTE public.profile_is_super_admin(uuid)'
);
RESET role;

-- ─────────────────────────────────────────────────────────────────────────────
-- AC6: Guarded-behaviour regressions
-- ─────────────────────────────────────────────────────────────────────────────

-- ── AC6a: append-only — payment_events ───────────────────────────────────────

-- Insert a payment_events row as service role (allowed)
INSERT INTO public.payment_events (
  order_id, event_key, status_code, amount_cents, currency, raw_payload
)
VALUES (
  '02100004-0000-0000-0000-000000000001',
  'S021-EVT-001', 2, 500, 'LKR', '{}'
);

SELECT throws_ok(
  $$UPDATE public.payment_events SET status_code = -1 WHERE event_key = 'S021-EVT-001'$$,
  '23001',
  NULL,
  'AC6a: UPDATE on payment_events raises restrict_violation (append-only)'
);

SELECT throws_ok(
  $$DELETE FROM public.payment_events WHERE event_key = 'S021-EVT-001'$$,
  '23001',
  NULL,
  'AC6a: DELETE on payment_events raises restrict_violation (append-only)'
);

-- ── AC6b: append-only — page_revisions ───────────────────────────────────────

SELECT throws_ok(
  $$UPDATE public.page_revisions
    SET version = 999
    WHERE id = '02100011-0000-0000-0000-000000000001'$$,
  '23001',
  NULL,
  'AC6b: UPDATE on page_revisions raises restrict_violation (append-only)'
);

SELECT throws_ok(
  $$DELETE FROM public.page_revisions
    WHERE id = '02100011-0000-0000-0000-000000000001'$$,
  '23001',
  NULL,
  'AC6b: DELETE on page_revisions raises restrict_violation (append-only)'
);

-- ── AC6c: append-only — admin_audit_log ──────────────────────────────────────

SELECT throws_ok(
  $$UPDATE public.admin_audit_log
    SET action = 'hacked'
    WHERE actor_id = '02100001-0000-0000-0000-000000000002'
      AND action = 'order.grant'$$,
  '23001',
  NULL,
  'AC6c: UPDATE on admin_audit_log raises restrict_violation (append-only)'
);

SELECT throws_ok(
  $$DELETE FROM public.admin_audit_log
    WHERE actor_id = '02100001-0000-0000-0000-000000000002'
      AND action = 'order.grant'$$,
  '23001',
  NULL,
  'AC6c: DELETE on admin_audit_log raises restrict_violation (append-only)'
);

-- ── AC6d: role_permissions write refused for Admin ───────────────────────────

SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"02100001-0000-0000-0000-000000000002","role":"authenticated"}';

SELECT throws_ok(
  $$INSERT INTO public.role_permissions (role, action)
    VALUES ('admin', 's021.test')$$,
  '42501',
  NULL,
  'AC6d: admin cannot INSERT into role_permissions (write guard)'
);

-- UPDATE: RLS has no UPDATE policy for authenticated; silent 0 rows affected (no exception).
DO $$
DECLARE rows_affected int;
BEGIN
  UPDATE public.role_permissions SET action = 's021.hacked' WHERE role = 'admin' AND action = 'orders.*';
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  ASSERT rows_affected = 0, format('AC6d: admin UPDATE role_permissions affected %s rows (expected 0)', rows_affected);
END $$;
SELECT pass('AC6d: admin cannot UPDATE role_permissions (write guard - 0 rows)');

RESET role;

-- ── AC6e: Super Admin protection trigger ─────────────────────────────────────
-- An Admin cannot delete the Super Admin's user_roles row.

SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"02100001-0000-0000-0000-000000000002","role":"authenticated"}';

-- DELETE: RLS has no DELETE policy for authenticated; silent 0 rows affected.
DO $$
DECLARE rows_affected int;
BEGIN
  DELETE FROM public.user_roles
    WHERE user_id = '02100001-0000-0000-0000-000000000001'
      AND role = 'super_admin';
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  ASSERT rows_affected = 0, format('AC6e: Admin DELETE user_roles affected %s rows (expected 0)', rows_affected);
END $$;
SELECT pass('AC6e: Admin RLS prevents deleting super_admin row from user_roles');

RESET role;

-- As superuser (postgres), the trigger allows the auth check through but blocks last-SA removal
SELECT throws_ok(
  $$DELETE FROM public.user_roles
    WHERE user_id = '02100001-0000-0000-0000-000000000001'
      AND role = 'super_admin'$$,
  'P0001',
  'not_allowed: cannot remove the last Super Admin',
  'AC6e: superuser trigger blocks last-super-admin deletion'
);

-- ── AC6f: site_settings group trigger — Admin without the right permission ────
-- admin has 'settings.site' so they CAN update 'site' group rows.
-- But admin has no 'settings.contact' permission, so updating a 'contact' row must fail.

INSERT INTO public.site_settings (key, value, setting_group, is_public)
VALUES ('s021_contact_key', '"contact"', 'contact', false)
ON CONFLICT DO NOTHING;

SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"02100001-0000-0000-0000-000000000002","role":"authenticated"}';

SELECT throws_ok(
  $$UPDATE public.site_settings SET value = '"hacked"' WHERE key = 's021_contact_key'$$,
  '23001',
  NULL,
  'AC6f: admin without settings.contact permission cannot update contact setting_group row'
);

-- Admin with settings.site permission CAN update a 'site' group row
SELECT lives_ok(
  $$UPDATE public.site_settings SET value = '"updated"' WHERE key = 's021_test_key'$$,
  'AC6f: admin with settings.site permission can update site setting_group row'
);

RESET role;

-- ── AC6g: claim_download race — second call after limit reached ───────────────
-- First call is service-role and exhausts the download_limit (1).
-- Second call must be refused with restrict_violation.

SELECT lives_ok(
  $$SELECT private.claim_download(
      '02100001-0000-0000-0000-000000000004'::uuid,
      '02100005-0000-0000-0000-000000000001'::uuid,
      'hash1'
    )$$,
  'AC6g: first claim_download succeeds'
);

SELECT throws_ok(
  $$SELECT private.claim_download(
      '02100001-0000-0000-0000-000000000004'::uuid,
      '02100005-0000-0000-0000-000000000001'::uuid,
      'hash2'
    )$$,
  '23001',
  NULL,
  'AC6g: second claim_download fails with restrict_violation (limit reached)'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- AC7: Index check
-- Every foreign key column has an index.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT
      c.conname,
      c.conrelid::regclass AS table_name,
      a.attname             AS col_name
    FROM pg_constraint c
    JOIN pg_class      cl ON cl.oid = c.conrelid
    JOIN pg_namespace  n  ON n.oid  = cl.relnamespace
    JOIN pg_attribute  a  ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
    WHERE c.contype = 'f'
      AND n.nspname = 'public'
      AND NOT EXISTS (
        SELECT 1
        FROM pg_index i
        WHERE i.indrelid = c.conrelid
          AND a.attnum = ANY(i.indkey)
      )
  LOOP
    RAISE EXCEPTION
      'AC7: foreign key column %.% (constraint %) has no index',
      r.table_name, r.col_name, r.conname;
  END LOOP;
END;
$$;

SELECT pass('AC7: every foreign key column has an index');

-- ── AC7: Critical partial and unique indexes exist ─────────────────────────────

-- document_files: unique (document_id, kind, language) WHERE is_current
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename  = 'document_files'
      AND indexdef LIKE '%is_current%'
  ),
  'AC7: document_files has partial unique index WHERE is_current'
);

-- payment_events: unique (event_key)
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename  = 'payment_events'
      AND indexdef LIKE '%event_key%'
      AND indexdef LIKE '%UNIQUE%'
  ),
  'AC7: payment_events has unique index on event_key'
);

-- orders: (user_id, created_at DESC)
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename  = 'orders'
      AND indexdef LIKE '%user_id%'
      AND indexdef LIKE '%created_at%'
  ),
  'AC7: orders has (user_id, created_at) index'
);

-- entitlements: unique (order_item_id) WHERE order_item_id IS NOT NULL
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename  = 'entitlements'
      AND indexdef LIKE '%order_item_id%'
      AND indexdef LIKE '%order_item_id IS NOT NULL%'
  ),
  'AC7: entitlements has partial unique index on order_item_id WHERE not null'
);

-- download_requests: unique (entitlement_id) WHERE status = 'open'
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename  = 'download_requests'
      AND indexdef LIKE '%entitlement_id%'
      AND indexdef LIKE '%open%'
  ),
  'AC7: download_requests has partial unique index on entitlement_id WHERE open'
);

-- admin_audit_log: (created_at)
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename  = 'admin_audit_log'
      AND indexdef LIKE '%created_at%'
  ),
  'AC7: admin_audit_log has (created_at) index'
);

-- coupons: unique (upper(code))
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename  = 'coupons'
      AND indexdef LIKE '%upper%'
      AND indexdef LIKE '%code%'
  ),
  'AC7: coupons has unique index on upper(code)'
);

-- profiles: unique (email)
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename  = 'profiles'
      AND indexdef LIKE '%email%'
      AND indexdef LIKE '%UNIQUE%'
  ),
  'AC7: profiles has unique index on email'
);

SELECT * FROM finish();
ROLLBACK;
