-- S-085: pgTAP tests for private.reject_download_request (AC11, AC12).
-- Verifies atomicity: status=rejected, decision_note, audit row, email row.
-- UUID prefix b2 to avoid collisions with other test files.

BEGIN;
SELECT plan(7);

-- ─── Fixtures ────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_buyer uuid := 'b2100000-0000-0000-0000-000000000001'::uuid;
  v_admin uuid := 'b2100000-0000-0000-0000-000000000002'::uuid;
  v_doc   uuid := 'b2200000-0000-0000-0000-000000000001'::uuid;
  v_ent   uuid := 'b2500000-0000-0000-0000-000000000001'::uuid;
  v_req   uuid := 'b2600000-0000-0000-0000-000000000001'::uuid;
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, role) VALUES
    (v_buyer, 'buyer_b2@test.invalid', 'x', 'authenticated'),
    (v_admin, 'admin_b2@test.invalid', 'x', 'authenticated')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (id, email, display_name) VALUES
    (v_buyer, 'buyer_b2@test.invalid', 'Buyer B2'),
    (v_admin, 'admin_b2@test.invalid', 'Admin B2')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.documents (id, title, slug, doc_kind, price_cents, status, published_at)
  VALUES (v_doc, 'B2 Test Doc', 'b2-test-doc', 'checklist', 1000, 'published', now())
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.entitlements (id, user_id, item_type, source, document_id, language, download_limit, downloads_used)
  VALUES (v_ent, v_buyer, 'document', 'purchase', v_doc, 'en', 1, 0)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.download_requests (id, entitlement_id, user_id, status)
  VALUES (v_req, v_ent, v_buyer, 'open')
  ON CONFLICT (id) DO NOTHING;
END;
$$;

-- ─── AC11: reject completes without error ────────────────────────────────────

SELECT lives_ok(
  $$
    SELECT private.reject_download_request(
      'b2600000-0000-0000-0000-000000000001'::uuid,
      'b2100000-0000-0000-0000-000000000002'::uuid,
      'Not eligible at this time'
    )
  $$,
  'reject_download_request completes without error'
);

-- ─── AC11: request status = rejected ─────────────────────────────────────────

SELECT is(
  (SELECT status FROM public.download_requests
   WHERE id = 'b2600000-0000-0000-0000-000000000001'),
  'rejected',
  'AC11: download_request status set to rejected'
);

SELECT is(
  (SELECT decision_note FROM public.download_requests
   WHERE id = 'b2600000-0000-0000-0000-000000000001'),
  'Not eligible at this time',
  'AC11: decision_note saved'
);

SELECT is(
  (SELECT decided_by FROM public.download_requests
   WHERE id = 'b2600000-0000-0000-0000-000000000001'),
  'b2100000-0000-0000-0000-000000000002'::uuid,
  'AC11: decided_by set to admin id'
);

-- ─── AC11: audit row written in same transaction ──────────────────────────────

SELECT is(
  (SELECT count(*)::int FROM public.admin_audit_log
   WHERE entity_id::text = 'b2600000-0000-0000-0000-000000000001'
     AND action = 'download_request.reject'),
  1,
  'AC11: admin_audit_log row written'
);

-- ─── AC11: email row queued in same transaction ───────────────────────────────

SELECT is(
  (SELECT count(*)::int FROM public.email_logs
   WHERE related_id::text = 'b2600000-0000-0000-0000-000000000001'
     AND template = 'download_request_rejected'),
  1,
  'AC11: email_logs row queued for rejection'
);

-- ─── AC12: double-reject raises restrict_violation ───────────────────────────

SELECT throws_ok(
  $$
    SELECT private.reject_download_request(
      'b2600000-0000-0000-0000-000000000001'::uuid,
      'b2100000-0000-0000-0000-000000000002'::uuid,
      'second attempt'
    )
  $$,
  '23001',
  'ceylonsafety: already_done',
  'AC12: second reject raises restrict_violation (already_done)'
);

SELECT * FROM finish();
ROLLBACK;
