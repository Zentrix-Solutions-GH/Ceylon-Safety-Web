-- S-019: Schema 9 — audit log, anonymise_user, views, append-only triggers
-- pgTAP tests: run against the fully-migrated database.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;
SELECT * FROM no_plan();

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed data
-- All IDs start with a19… to avoid collision with other test files.
-- ─────────────────────────────────────────────────────────────────────────────

-- Pages + revisions (required FK for orders)
INSERT INTO public.pages (id, slug, title)
VALUES
  ('a1900010-0000-0000-0000-000000000001', 'terms-s019',  'Terms S019'),
  ('a1900010-0000-0000-0000-000000000002', 'refund-s019', 'Refund S019')
ON CONFLICT DO NOTHING;

INSERT INTO public.page_revisions (id, page_id, version, published_at)
VALUES
  ('a1900011-0000-0000-0000-000000000001', 'a1900010-0000-0000-0000-000000000001', 1, now()),
  ('a1900011-0000-0000-0000-000000000002', 'a1900010-0000-0000-0000-000000000002', 1, now())
ON CONFLICT DO NOTHING;

-- Profiles
INSERT INTO public.profiles (id, display_name, email, status)
VALUES
  ('a1900001-0000-0000-0000-000000000001', 'SA One',     'sa1.s019@test.invalid',    'active'),
  ('a1900001-0000-0000-0000-000000000002', 'Admin One',  'admin1.s019@test.invalid',  'active'),
  ('a1900001-0000-0000-0000-000000000003', 'Cust One',   'cust1.s019@test.invalid',   'active'),
  ('a1900001-0000-0000-0000-000000000004', 'Cust Two',   'cust2.s019@test.invalid',   'active'),
  ('a1900001-0000-0000-0000-000000000005', 'Cust Three', 'cust3.s019@test.invalid',   'active'),
  ('a1900001-0000-0000-0000-000000000006', 'Cust Four',  'cust4.s019@test.invalid',   'active'),
  ('a1900001-0000-0000-0000-000000000007', 'Maint One',  'maint1.s019@test.invalid',  'active')
ON CONFLICT (id) DO NOTHING;

-- Roles
INSERT INTO public.user_roles (user_id, role, granted_by)
VALUES
  ('a1900001-0000-0000-0000-000000000001', 'super_admin',  'a1900001-0000-0000-0000-000000000001'),
  ('a1900001-0000-0000-0000-000000000002', 'admin',        'a1900001-0000-0000-0000-000000000001'),
  -- Maintainer has no audit.read permission → used to prove is_staff_member() alone is not enough
  ('a1900001-0000-0000-0000-000000000007', 'maintainer',   'a1900001-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- role_permissions: give admin the audit.read action
INSERT INTO public.role_permissions (role, action)
VALUES ('admin', 'audit.read')
ON CONFLICT DO NOTHING;

-- Category
INSERT INTO public.categories (id, slug, name, applies_to)
VALUES ('b1900001-0000-0000-0000-000000000001', 's019-cat', 'S019 Cat', ARRAY['article','video'])
ON CONFLICT (id) DO NOTHING;

-- Articles
INSERT INTO public.articles (id, locale, slug, title, status, published_at, body, body_text, like_count, comment_count, category_id)
VALUES
  ('c1900001-0000-0000-0000-000000000001', 'en', 's019-pub-art',   'S019 Published Article',  'published',
   now() - interval '1 hour', '{"type":"doc","content":[]}', 'text', 5, 2,
   'b1900001-0000-0000-0000-000000000001'),
  ('c1900001-0000-0000-0000-000000000002', 'en', 's019-draft-art', 'S019 Draft Article',      'draft',
   NULL, '{"type":"doc","content":[]}', '', 0, 0,
   NULL),
  ('c1900001-0000-0000-0000-000000000003', 'en', 's019-sched-art',   'S019 Scheduled Article',  'published',
   now() + interval '1 day', '{"type":"doc","content":[]}', '', 0, 0,
   NULL),
  -- Deleted but published: must be hidden from browser callers via base-table RLS (P2)
  ('c1900001-0000-0000-0000-000000000004', 'en', 's019-deleted-art', 'S019 Deleted Article',    'published',
   now() - interval '1 hour', '{"type":"doc","content":[]}', '', 0, 0,
   NULL)
ON CONFLICT (id) DO NOTHING;

UPDATE public.articles
  SET deleted_at = now() - interval '30 minutes'
  WHERE id = 'c1900001-0000-0000-0000-000000000004';

-- Video (no slug column; youtube_id must be exactly 11 [A-Za-z0-9_-] chars)
INSERT INTO public.videos (id, locale, youtube_id, title, thumbnail_key, status, published_at, like_count, comment_count, category_id)
VALUES
  ('d1900001-0000-0000-0000-000000000001', 'en', 'S019VidTest', 'S019 Published Video', 'thumb/s019key',
   'published', now() - interval '2 hours', 3, 1,
   'b1900001-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Documents
INSERT INTO public.documents (id, slug, title, doc_kind, price_cents, status, published_at, download_count)
VALUES
  ('e1900001-0000-0000-0000-000000000001', 's019-pub-doc',   'S019 Published Doc', 'checklist', 500,
   'published', now() - interval '1 hour', 7),
  ('e1900001-0000-0000-0000-000000000002', 's019-draft-doc', 'S019 Draft Doc',     'checklist', 500,
   'draft', NULL, 0)
ON CONFLICT (id) DO NOTHING;

-- Coupon (for EC4)
INSERT INTO public.coupons (id, code, discount_type, discount_value, expires_at, max_uses, uses_count, is_active)
VALUES ('a1900009-0000-0000-0000-000000000001', 'S019COUPON', 'fixed', 10, now() + interval '1 year', 100, 1, true)
ON CONFLICT (id) DO NOTHING;

-- Carts
INSERT INTO public.carts (user_id) VALUES
  ('a1900001-0000-0000-0000-000000000004'),
  ('a1900001-0000-0000-0000-000000000005')
ON CONFLICT DO NOTHING;

-- Plain pending payhere order for Cust Three (EC4 — to be cancelled)
INSERT INTO public.orders (
  id, order_number, user_id, status,
  subtotal_cents, discount_cents, total_cents,
  terms_revision_id, refund_policy_revision_id, terms_accepted_at,
  payment_provider
) VALUES (
  'a1900008-0000-0000-0000-000000000001',
  'CS-S019-00001',
  'a1900001-0000-0000-0000-000000000005',
  'pending',
  1000, 10, 990,
  'a1900011-0000-0000-0000-000000000001',
  'a1900011-0000-0000-0000-000000000002',
  now(),
  'payhere'
) ON CONFLICT DO NOTHING;

-- Coupon use on that order
INSERT INTO public.coupon_uses (coupon_id, order_id, user_id)
VALUES (
  'a1900009-0000-0000-0000-000000000001',
  'a1900008-0000-0000-0000-000000000001',
  'a1900001-0000-0000-0000-000000000005'
) ON CONFLICT DO NOTHING;

-- Paid order for Cust Four (EC3 — stays untouched)
INSERT INTO public.orders (
  id, order_number, user_id, status,
  subtotal_cents, discount_cents, total_cents,
  terms_revision_id, refund_policy_revision_id, terms_accepted_at,
  payment_provider, paid_at
) VALUES (
  'a1900008-0000-0000-0000-000000000002',
  'CS-S019-00002',
  'a1900001-0000-0000-0000-000000000006',
  'paid',
  3000, 0, 3000,
  'a1900011-0000-0000-0000-000000000001',
  'a1900011-0000-0000-0000-000000000002',
  now(),
  'payhere', now()
) ON CONFLICT DO NOTHING;

-- Pending-verification bank order for Cust Two (EC9 — NOT cancelled)
INSERT INTO public.orders (
  id, order_number, user_id, status,
  subtotal_cents, discount_cents, total_cents,
  terms_revision_id, refund_policy_revision_id, terms_accepted_at,
  payment_provider
) VALUES (
  'a1900008-0000-0000-0000-000000000003',
  'CS-S019-00003',
  'a1900001-0000-0000-0000-000000000004',
  'pending_verification',
  2000, 0, 2000,
  'a1900011-0000-0000-0000-000000000001',
  'a1900011-0000-0000-0000-000000000002',
  now(),
  'bank_transfer'
) ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- AC1: admin_audit_log schema
-- ─────────────────────────────────────────────────────────────────────────────

SELECT has_table('public', 'admin_audit_log', 'AC1: admin_audit_log table exists');
SELECT has_column('public', 'admin_audit_log', 'id',          'AC1: id column');
SELECT has_column('public', 'admin_audit_log', 'actor_id',    'AC1: actor_id column');
SELECT has_column('public', 'admin_audit_log', 'action',      'AC1: action column');
SELECT has_column('public', 'admin_audit_log', 'entity_type', 'AC1: entity_type column');
SELECT has_column('public', 'admin_audit_log', 'entity_id',   'AC1: entity_id column');
SELECT has_column('public', 'admin_audit_log', 'before',      'AC1: before column');
SELECT has_column('public', 'admin_audit_log', 'after',       'AC1: after column');
SELECT has_column('public', 'admin_audit_log', 'created_at',  'AC1: created_at column');
SELECT col_type_is('public', 'admin_audit_log', 'id', 'bigint', 'AC1: id is bigint');

SELECT has_index('public', 'admin_audit_log', 'admin_audit_log_created_at_idx',
  'AC1: index on created_at');
SELECT has_index('public', 'admin_audit_log', 'admin_audit_log_actor_created_idx',
  'AC1: index on (actor_id, created_at)');

-- EC6: unlisted action is refused
SELECT throws_ok(
  $$INSERT INTO public.admin_audit_log (actor_id, action, entity_type, entity_id)
    VALUES ('a1900001-0000-0000-0000-000000000002', 'foo.bar', 'user', 'x')$$,
  '23514',
  NULL,
  'EC6: action not in enum refused (check_violation)');

-- Valid action inserts OK
DO $$
BEGIN
  INSERT INTO public.admin_audit_log (actor_id, action, entity_type, entity_id)
  VALUES ('a1900001-0000-0000-0000-000000000002', 'settings.change', 'settings', 'site');
END $$;
SELECT ok(true, 'AC1: valid action inserts without error');

-- ─────────────────────────────────────────────────────────────────────────────
-- AC2: append-only enforcement
-- ─────────────────────────────────────────────────────────────────────────────

SELECT has_trigger('public', 'admin_audit_log', 'trg_admin_audit_log_append_only',
  'AC2: append-only trigger on admin_audit_log');
SELECT has_trigger('public', 'payment_events', 'trg_payment_events_append_only',
  'AC2: append-only trigger on payment_events');
SELECT has_trigger('public', 'page_revisions', 'trg_page_revisions_append_only',
  'AC2: append-only trigger on page_revisions');

-- admin_audit_log: UPDATE refused (even as postgres/service_role)
SELECT throws_ok(
  $$UPDATE public.admin_audit_log SET entity_id = 'changed'
    WHERE id = (SELECT id FROM public.admin_audit_log LIMIT 1)$$,
  '23001',
  NULL,
  'AC2: UPDATE on admin_audit_log refused (append-only)');

-- admin_audit_log: DELETE refused without purge flag
-- Use a real row; the trigger fires even with 0 matching rows only if there ARE rows,
-- so insert one then attempt to delete it.
SELECT throws_ok(
  $$DELETE FROM public.admin_audit_log WHERE id = (SELECT id FROM public.admin_audit_log LIMIT 1)$$,
  '23001',
  NULL,
  'AC2: direct DELETE on admin_audit_log refused');

-- purge_old_audit_rows: deletes old rows; keeps recent ones
DO $$
DECLARE
  v_old_id bigint;
  v_new_id bigint;
BEGIN
  INSERT INTO public.admin_audit_log (actor_id, action, created_at)
  VALUES ('a1900001-0000-0000-0000-000000000002', 'settings.change', now() - interval '5 years')
  RETURNING id INTO v_old_id;

  INSERT INTO public.admin_audit_log (actor_id, action)
  VALUES ('a1900001-0000-0000-0000-000000000002', 'settings.change')
  RETURNING id INTO v_new_id;

  PERFORM private.purge_old_audit_rows(now() - interval '1 year');

  IF EXISTS (SELECT 1 FROM public.admin_audit_log WHERE id = v_old_id) THEN
    RAISE EXCEPTION 'AC2: old audit row NOT deleted by purge_old_audit_rows';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.admin_audit_log WHERE id = v_new_id) THEN
    RAISE EXCEPTION 'AC2: recent audit row deleted by purge_old_audit_rows (wrong)';
  END IF;
END $$;
SELECT ok(true, 'AC2: purge_old_audit_rows deletes old rows and keeps recent ones');

-- payment_events: DELETE is refused for all roles
DO $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.payment_events (order_id, event_key, outcome, raw_payload)
  VALUES ('a1900008-0000-0000-0000-000000000001', 's019-evt-key', 'applied', '{}')
  RETURNING id INTO v_id;

  -- DELETE must be refused (even as postgres/service_role)
  BEGIN
    DELETE FROM public.payment_events WHERE id = v_id;
    RAISE EXCEPTION 'AC2: DELETE on payment_events should have been refused';
  EXCEPTION
    WHEN restrict_violation THEN NULL;
  END;
END $$;
SELECT ok(true, 'AC2: payment_events DELETE refused for all roles');

-- AC2: plain UPDATE on payment_events WITHOUT the session flag must be refused
-- (this test must run before the SET LOCAL below, which persists for the transaction)
SELECT throws_ok(
  $$UPDATE public.payment_events SET raw_payload = '{}' WHERE id IN (SELECT id FROM public.payment_events LIMIT 1)$$,
  '23001',
  NULL,
  'AC2: payment_events UPDATE without ceylonsafety.nulling_payload flag is refused');

-- payment_events: UPDATE is allowed only with the ceylonsafety.nulling_payload flag
-- (set exclusively by private.purge_old_logs, which has no story yet).
-- Test the mechanism directly by setting the flag in a transaction-scoped block.
DO $$
BEGIN
  SET LOCAL "ceylonsafety.nulling_payload" = 'true';
  UPDATE public.payment_events SET raw_payload = NULL
    WHERE id IN (SELECT id FROM public.payment_events LIMIT 1);
END $$;
SELECT ok(true, 'AC2: payment_events UPDATE allowed with ceylonsafety.nulling_payload flag');

-- page_revisions: DELETE refused (no exceptions at all)
DO $$
DECLARE
  v_rev_id uuid;
BEGIN
  v_rev_id := 'a1900011-0000-0000-0000-000000000001';
  BEGIN
    DELETE FROM public.page_revisions WHERE id = v_rev_id;
    RAISE EXCEPTION 'AC2: DELETE on page_revisions should have been refused';
  EXCEPTION
    WHEN restrict_violation THEN NULL;
  END;
END $$;
SELECT ok(true, 'AC2: page_revisions DELETE refused (no exception path)');

-- ─────────────────────────────────────────────────────────────────────────────
-- AC3/EC5: admin_audit_log RLS
-- ─────────────────────────────────────────────────────────────────────────────

-- Insert audit rows for RLS tests (as postgres/service_role, bypasses RLS)
INSERT INTO public.admin_audit_log (actor_id, action, entity_type, entity_id)
VALUES
  -- SA actor row (should be hidden from non-SA)
  ('a1900001-0000-0000-0000-000000000001', 'settings.change', 'settings', 'site'),
  -- Admin actor, SA entity target (should be hidden from non-SA)
  ('a1900001-0000-0000-0000-000000000002', 'role.change', 'user', 'a1900001-0000-0000-0000-000000000001'),
  -- Admin actor, non-SA target (visible to admin)
  ('a1900001-0000-0000-0000-000000000002', 'settings.change', 'settings', 'site');

-- Admin can read non-SA rows
SET ROLE authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"a1900001-0000-0000-0000-000000000002","role":"authenticated"}';

SELECT ok(
  (SELECT COUNT(*) FROM public.admin_audit_log) > 0,
  'AC3: admin with audit.read can read non-SA audit rows'
);

-- Admin cannot see rows where actor is SA (EC5)
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public.admin_audit_log
    WHERE actor_id = 'a1900001-0000-0000-0000-000000000001'::uuid
  ),
  'EC5/AC3: admin cannot see rows where actor is Super Admin'
);

-- Admin cannot see rows where entity_id is a SA user
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public.admin_audit_log
    WHERE entity_type = 'user'
      AND entity_id = 'a1900001-0000-0000-0000-000000000001'
  ),
  'AC3: admin cannot see rows where entity_id is a Super Admin user'
);

-- Customer sees 0 audit rows (no policy)
SET LOCAL request.jwt.claims TO '{"sub":"a1900001-0000-0000-0000-000000000003","role":"authenticated"}';
SELECT ok(
  (SELECT COUNT(*) FROM public.admin_audit_log) = 0,
  'AC3: customer sees 0 audit rows (no policy)'
);

-- P2: staff member (maintainer) without audit.read permission sees 0 rows
-- Proves is_staff_member() alone is not sufficient — has_permission('audit.read') is also required.
SET LOCAL request.jwt.claims TO '{"sub":"a1900001-0000-0000-0000-000000000007","role":"authenticated"}';
SELECT ok(
  (SELECT COUNT(*) FROM public.admin_audit_log) = 0,
  'AC3/P2: maintainer without audit.read sees 0 audit rows');

RESET ROLE;

-- Super Admin sees SA-actor rows
SET ROLE authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"a1900001-0000-0000-0000-000000000001","role":"authenticated"}';
SELECT ok(
  EXISTS (
    SELECT 1 FROM public.admin_audit_log
    WHERE actor_id = 'a1900001-0000-0000-0000-000000000001'::uuid
  ),
  'AC3: Super Admin sees rows where actor is themselves'
);
RESET ROLE;

-- AC3: authenticated client INSERT on admin_audit_log must be refused
SET ROLE authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"a1900001-0000-0000-0000-000000000002","role":"authenticated"}';
SELECT throws_ok(
  $$INSERT INTO public.admin_audit_log (actor_id, action) VALUES ('a1900001-0000-0000-0000-000000000002', 'settings.change')$$,
  '42501',
  NULL,
  'AC3: authenticated client INSERT on admin_audit_log is refused');
RESET ROLE;

-- ─────────────────────────────────────────────────────────────────────────────
-- AC4/EC2: anonymise_user refuses staff
-- ─────────────────────────────────────────────────────────────────────────────

SELECT throws_ok(
  $$SELECT private.anonymise_user('a1900001-0000-0000-0000-000000000002')$$,
  '23001',
  NULL,
  'EC2: anonymise_user refuses admin account');

SELECT throws_ok(
  $$SELECT private.anonymise_user('a1900001-0000-0000-0000-000000000001')$$,
  '23001',
  NULL,
  'EC2: anonymise_user refuses super_admin account');

-- ─────────────────────────────────────────────────────────────────────────────
-- EC4: Cust Three — pending payhere order with coupon cancelled + coupon released
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE v_uses_before int;
BEGIN
  SELECT uses_count INTO v_uses_before
  FROM public.coupons WHERE id = 'a1900009-0000-0000-0000-000000000001';

  PERFORM private.anonymise_user('a1900001-0000-0000-0000-000000000005');
END $$;

SELECT ok(
  EXISTS (SELECT 1 FROM public.profiles
          WHERE id = 'a1900001-0000-0000-0000-000000000005'
            AND deleted_at IS NOT NULL AND display_name = 'Deleted user'
            AND status = 'anonymised'),
  'EC4/AC4: Cust Three profile anonymised correctly');

SELECT ok(
  EXISTS (SELECT 1 FROM public.orders
          WHERE id = 'a1900008-0000-0000-0000-000000000001'
            AND status = 'cancelled'
            AND cancel_reason = 'account_deleted'),
  'EC4: pending payhere order cancelled with cancel_reason = account_deleted');

SELECT ok(
  EXISTS (SELECT 1 FROM public.coupon_uses
          WHERE order_id = 'a1900008-0000-0000-0000-000000000001' AND released_at IS NOT NULL),
  'EC4: coupon use released when order cancelled');

SELECT ok(
  (SELECT uses_count FROM public.coupons WHERE id = 'a1900009-0000-0000-0000-000000000001') < 1,
  'EC4: coupon uses_count decremented after order cancel');

-- ─────────────────────────────────────────────────────────────────────────────
-- EC3: Cust Four — paid order untouched, profile anonymised
-- ─────────────────────────────────────────────────────────────────000000000000-

DO $$
BEGIN
  PERFORM private.anonymise_user('a1900001-0000-0000-0000-000000000006');
END $$;

SELECT ok(
  EXISTS (SELECT 1 FROM public.profiles
          WHERE id = 'a1900001-0000-0000-0000-000000000006' AND deleted_at IS NOT NULL),
  'EC3: Cust Four profile anonymised');

SELECT ok(
  EXISTS (SELECT 1 FROM public.orders
          WHERE id = 'a1900008-0000-0000-0000-000000000002' AND status = 'paid'),
  'EC3: paid order remains untouched after anonymise');

-- ─────────────────────────────────────────────────────────────────────────────
-- EC9: Cust Two — pending_verification bank order NOT cancelled
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  PERFORM private.anonymise_user('a1900001-0000-0000-0000-000000000004');
END $$;

SELECT ok(
  EXISTS (SELECT 1 FROM public.orders
          WHERE id = 'a1900008-0000-0000-0000-000000000003' AND status = 'pending_verification'),
  'EC9: pending_verification bank order not cancelled on anonymise');

SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.carts WHERE user_id = 'a1900001-0000-0000-0000-000000000004'),
  'AC4: cart removed on anonymise');

-- ─────────────────────────────────────────────────────────────────────────────
-- AC4: PII columns cleared
-- ─────────────────────────────────────────────────────────────────────────────

SELECT ok(
  (SELECT first_name IS NULL AND last_name IS NULL AND phone IS NULL
          AND company_name IS NULL AND tax_id IS NULL AND billing_address IS NULL
          AND avatar_url IS NULL AND display_name = 'Deleted user'
          AND email LIKE 'deleted-%@invalid'
   FROM public.profiles WHERE id = 'a1900001-0000-0000-0000-000000000004'),
  'AC4: all PII columns cleared on anonymise');

-- EC1: second run is idempotent
DO $$
BEGIN
  PERFORM private.anonymise_user('a1900001-0000-0000-0000-000000000004');
END $$;
SELECT ok(true, 'EC1: anonymise_user idempotent (second run raises no error)');

-- AC4: user with no cart or orders
DO $$
BEGIN
  PERFORM private.anonymise_user('a1900001-0000-0000-0000-000000000003');
END $$;
SELECT ok(true, 'AC4: anonymise_user works on user with no cart or orders');

-- ─────────────────────────────────────────────────────────────────────────────
-- AC5: public_profiles view
-- ─────────────────────────────────────────────────────────────────────────────

SELECT has_view('public', 'public_profiles', 'AC5: public_profiles view exists');
SELECT has_column('public', 'public_profiles', 'id',           'AC5: id column');
SELECT has_column('public', 'public_profiles', 'display_name', 'AC5: display_name column');
SELECT has_column('public', 'public_profiles', 'avatar_url',   'AC5: avatar_url column');
SELECT has_column('public', 'public_profiles', 'is_staff',     'AC5: is_staff column');
SELECT hasnt_column('public', 'public_profiles', 'email', 'AC5: email not exposed');
SELECT hasnt_column('public', 'public_profiles', 'phone', 'AC5: phone not exposed');

SELECT ok(
  (SELECT is_staff FROM public.public_profiles WHERE id = 'a1900001-0000-0000-0000-000000000002'),
  'AC5: admin has is_staff = true');

-- Super Admin: is_staff must be false (EC5/REQ-130c)
SELECT ok(
  NOT COALESCE((SELECT is_staff FROM public.public_profiles
                WHERE id = 'a1900001-0000-0000-0000-000000000001'), false),
  'EC5/AC5: super_admin has is_staff = false');

-- Customer: is_staff false
SELECT ok(
  NOT COALESCE((SELECT is_staff FROM public.public_profiles
                WHERE id = 'a1900001-0000-0000-0000-000000000003'), false),
  'AC5: customer has is_staff = false');

-- Anonymised user appears as "Deleted user" with no avatar
SELECT ok(
  EXISTS (SELECT 1 FROM public.public_profiles
          WHERE id = 'a1900001-0000-0000-0000-000000000004'
            AND display_name = 'Deleted user' AND avatar_url IS NULL),
  'AC5: anonymised user appears as ''Deleted user'' in public_profiles');

-- ─────────────────────────────────────────────────────────────────────────────
-- AC6/EC7: feed_items view
-- ─────────────────────────────────────────────────────────────────────────────

SELECT has_view('public', 'feed_items', 'AC6: feed_items view exists');

SELECT ok(
  EXISTS (SELECT 1 FROM public.feed_items
          WHERE id = 'c1900001-0000-0000-0000-000000000001' AND kind = 'article'),
  'AC6: published article appears in feed_items');

SELECT ok(
  EXISTS (SELECT 1 FROM public.feed_items
          WHERE id = 'd1900001-0000-0000-0000-000000000001' AND kind = 'video'),
  'AC6: published video appears in feed_items');

SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.feed_items WHERE id = 'c1900001-0000-0000-0000-000000000002'),
  'AC6: draft article not in feed_items');

-- Scheduled article: feed_items includes it (view is not filtered) but the
-- consuming query (security_invoker) must filter published_at <= now() itself.
-- EC7: verify the scheduled row IS in the view (filter is caller's job)
SELECT ok(
  EXISTS (SELECT 1 FROM public.feed_items WHERE id = 'c1900001-0000-0000-0000-000000000003'),
  'AC6: scheduled article IS in feed_items (caller must apply published_at <= now() filter)');

-- P2: deleted-but-published article must be hidden from authenticated browser callers.
-- security_invoker = true means the articles RLS (deleted_at IS NULL) applies to the caller.
SET ROLE authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"a1900001-0000-0000-0000-000000000003","role":"authenticated"}';
SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.feed_items WHERE id = 'c1900001-0000-0000-0000-000000000004'),
  'AC6/P2: deleted published article is hidden from authenticated browser callers via security_invoker RLS');
RESET ROLE;

-- ─────────────────────────────────────────────────────────────────────────────
-- AC7/EC7: home_counters view
-- ─────────────────────────────────────────────────────────────────────────────

SELECT has_view('public', 'home_counters', 'AC7: home_counters view exists');

SELECT ok(
  (SELECT published_articles >= 0 AND published_documents >= 0
          AND registered_users >= 0 AND total_downloads >= 0
   FROM public.home_counters),
  'AC7: home_counters values are non-negative');

-- Anonymised users NOT counted
SELECT ok(
  (SELECT registered_users FROM public.home_counters) =
  (SELECT COUNT(*) FROM public.profiles WHERE deleted_at IS NULL),
  'EC7/AC7: registered_users excludes anonymised');

-- Draft document NOT counted
SELECT ok(
  (SELECT published_documents FROM public.home_counters) =
  (SELECT COUNT(*) FROM public.documents
   WHERE status = 'published' AND published_at <= now() AND deleted_at IS NULL),
  'EC7/AC7: published_documents excludes drafts');

-- total_downloads = SUM(documents.download_count) — includes all documents
SELECT ok(
  (SELECT total_downloads FROM public.home_counters) =
  (SELECT COALESCE(SUM(download_count), 0) FROM public.documents),
  'AC7: total_downloads = SUM(documents.download_count)');

-- Scheduled article NOT in home_counters published_articles (published_at > now())
SELECT ok(
  (SELECT published_articles FROM public.home_counters) =
  (SELECT COUNT(*) FROM public.articles
   WHERE status = 'published' AND published_at <= now() AND deleted_at IS NULL),
  'EC7/AC7: published_articles excludes scheduled articles');

-- ─────────────────────────────────────────────────────────────────────────────
-- AC8: report views
-- ─────────────────────────────────────────────────────────────────────────────

SELECT has_view('public', 'report_daily_sales',   'AC8: report_daily_sales view exists');
SELECT has_view('public', 'report_top_documents', 'AC8: report_top_documents view exists');

-- EC8: report_daily_sales groups by Asia/Colombo — functional timezone boundary test.
-- An order paid at 23:30 UTC on 2026-10-14 is the next day (2026-10-15) in Colombo
-- (UTC+5:30 = 05:00 on 2026-10-15).
DO $$
DECLARE
  v_order_id uuid;
  v_sale_date date;
BEGIN
  INSERT INTO public.orders (
    id, order_number, user_id, status,
    subtotal_cents, discount_cents, total_cents,
    terms_revision_id, refund_policy_revision_id, terms_accepted_at,
    payment_provider, paid_at
  ) VALUES (
    gen_random_uuid(),
    'CS-S019-EC8-TEST',
    'a1900001-0000-0000-0000-000000000006',
    'paid',
    1000, 0, 1000,
    'a1900011-0000-0000-0000-000000000001',
    'a1900011-0000-0000-0000-000000000002',
    now(),
    'payhere',
    '2026-10-14 23:30:00+00'
  ) RETURNING id INTO v_order_id;

  SELECT sale_date INTO v_sale_date
  FROM public.report_daily_sales
  WHERE sale_date = '2026-10-15';

  IF v_sale_date IS NULL THEN
    RAISE EXCEPTION 'EC8: order at 23:30 UTC did not appear under 2026-10-15 in Colombo';
  END IF;

  DELETE FROM public.orders WHERE id = v_order_id;
END $$;
SELECT ok(true, 'EC8: 23:30 UTC order appears under next day (2026-10-15) in Asia/Colombo');

-- Anon cannot read report views (SELECT revoked)
SET ROLE anon;
SELECT throws_ok(
  $$SELECT COUNT(*) FROM public.report_daily_sales$$,
  '42501', NULL,
  'AC8: anon cannot read report_daily_sales');
SELECT throws_ok(
  $$SELECT COUNT(*) FROM public.report_top_documents$$,
  '42501', NULL,
  'AC8: anon cannot read report_top_documents');
RESET ROLE;

-- Authenticated customer cannot read report views (SELECT revoked)
SET ROLE authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"a1900001-0000-0000-0000-000000000003","role":"authenticated"}';
SELECT throws_ok(
  $$SELECT COUNT(*) FROM public.report_daily_sales$$,
  '42501', NULL,
  'AC8: authenticated customer cannot read report_daily_sales');
SELECT throws_ok(
  $$SELECT COUNT(*) FROM public.report_top_documents$$,
  '42501', NULL,
  'AC8: authenticated customer cannot read report_top_documents');
RESET ROLE;

-- ─────────────────────────────────────────────────────────────────────────────
-- AC9: function exposure
-- ─────────────────────────────────────────────────────────────────────────────

-- Private functions must NOT be in public schema
SELECT hasnt_function('public', 'anonymise_user', ARRAY['uuid'],
  'AC9: anonymise_user is in private schema, not public');

SELECT hasnt_function('public', 'purge_old_audit_rows', ARRAY['timestamp with time zone'],
  'AC9: purge_old_audit_rows is in private schema, not public');

-- AC9: authenticated role cannot EXECUTE private.anonymise_user (EXECUTE revoked)
SET ROLE authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"a1900001-0000-0000-0000-000000000003","role":"authenticated"}';
SELECT throws_ok(
  $$SELECT private.anonymise_user('a1900001-0000-0000-0000-000000000004'::uuid)$$,
  '42501',
  NULL,
  'AC9: authenticated cannot EXECUTE private.anonymise_user');
RESET ROLE;

-- Browser-callable public functions exist
SELECT has_function('public', 'has_permission',  ARRAY['text'],     'AC9: has_permission in public');
SELECT has_function('public', 'is_staff_member', ARRAY[]::text[],   'AC9: is_staff_member in public');
SELECT has_function('public', 'is_super_admin',  ARRAY[]::text[],   'AC9: is_super_admin in public');

-- Anon sees 0 rows from admin_audit_log (no policy for anon role)
SET ROLE anon;
SELECT ok(
  (SELECT COUNT(*) FROM public.admin_audit_log) = 0,
  'AC3/AC9: anon sees 0 audit rows (no SELECT policy for anon)');
RESET ROLE;

-- AC10: verify admin_audit_log and all five views are present in information_schema
SELECT ok(
  (SELECT COUNT(*) FROM information_schema.tables
   WHERE table_schema = 'public'
     AND table_name = 'admin_audit_log'
     AND table_type = 'BASE TABLE') = 1,
  'AC10: admin_audit_log table present in schema');

SELECT ok(
  (SELECT COUNT(*) FROM information_schema.views
   WHERE table_schema = 'public'
     AND table_name IN ('public_profiles','feed_items','home_counters',
                        'report_daily_sales','report_top_documents')) = 5,
  'AC10: all five views present in schema (types/database.ts regenerated covers type safety)');

SELECT * FROM finish();
ROLLBACK;
