-- S-085: pgTAP tests for private.approve_download_request (AC10, AC12).
-- Verifies atomicity: download_limit++, status=approved, audit row, email row.
-- UUID prefix a1 to avoid collisions with other test files.

BEGIN;
SELECT plan(7);

-- ─── Fixtures ────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_buyer uuid := 'a1100000-0000-0000-0000-000000000001'::uuid;
  v_admin uuid := 'a1100000-0000-0000-0000-000000000002'::uuid;
  v_doc   uuid := 'a1200000-0000-0000-0000-000000000001'::uuid;
  v_ent   uuid := 'a1500000-0000-0000-0000-000000000001'::uuid;
  v_req   uuid := 'a1600000-0000-0000-0000-000000000001'::uuid;
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, role) VALUES
    (v_buyer, 'buyer_a1@test.invalid', 'x', 'authenticated'),
    (v_admin, 'admin_a1@test.invalid', 'x', 'authenticated')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (id, email, display_name) VALUES
    (v_buyer, 'buyer_a1@test.invalid', 'Buyer A1'),
    (v_admin, 'admin_a1@test.invalid', 'Admin A1')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.documents (id, title, slug, doc_kind, price_cents, status, published_at)
  VALUES (v_doc, 'A1 Test Doc', 'a1-test-doc', 'checklist', 1000, 'published', now())
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.entitlements (id, user_id, item_type, source, document_id, language, download_limit, downloads_used)
  VALUES (v_ent, v_buyer, 'document', 'purchase', v_doc, 'en', 1, 0)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.download_requests (id, entitlement_id, user_id, status)
  VALUES (v_req, v_ent, v_buyer, 'open')
  ON CONFLICT (id) DO NOTHING;
END;
$$;

-- ─── AC10: approve increments download_limit ─────────────────────────────────

SELECT lives_ok(
  $$
    SELECT private.approve_download_request(
      'a1600000-0000-0000-0000-000000000001'::uuid,
      'a1100000-0000-0000-0000-000000000002'::uuid
    )
  $$,
  'approve_download_request completes without error'
);

SELECT is(
  (SELECT download_limit FROM public.entitlements
   WHERE id = 'a1500000-0000-0000-0000-000000000001'),
  2,
  'AC10: download_limit incremented from 1 to 2 after approval'
);

-- ─── AC10: request status = approved ─────────────────────────────────────────

SELECT is(
  (SELECT status FROM public.download_requests
   WHERE id = 'a1600000-0000-0000-0000-000000000001'),
  'approved',
  'AC10: download_request status set to approved'
);

SELECT is(
  (SELECT decided_by FROM public.download_requests
   WHERE id = 'a1600000-0000-0000-0000-000000000001'),
  'a1100000-0000-0000-0000-000000000002'::uuid,
  'AC10: decided_by set to admin id'
);

-- ─── AC10: audit row written in same transaction ──────────────────────────────

SELECT is(
  (SELECT count(*)::int FROM public.admin_audit_log
   WHERE entity_id::text = 'a1600000-0000-0000-0000-000000000001'
     AND action = 'download_request.approve'),
  1,
  'AC10: admin_audit_log row written'
);

-- ─── AC10: email row queued in same transaction ───────────────────────────────

SELECT is(
  (SELECT count(*)::int FROM public.email_logs
   WHERE related_id::text = 'a1600000-0000-0000-0000-000000000001'
     AND template = 'download_request_approved'),
  1,
  'AC10: email_logs row queued for approval'
);

-- ─── AC12: double-approve raises restrict_violation ──────────────────────────

SELECT throws_ok(
  $$
    SELECT private.approve_download_request(
      'a1600000-0000-0000-0000-000000000001'::uuid,
      'a1100000-0000-0000-0000-000000000002'::uuid
    )
  $$,
  '23001',
  'ceylonsafety: already_done',
  'AC12: second approve raises restrict_violation (already_done)'
);

SELECT * FROM finish();
ROLLBACK;
