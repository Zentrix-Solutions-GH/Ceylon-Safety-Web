-- S-085: RLS tests for download_logs and download_requests
-- Run with: supabase test db

BEGIN;
SELECT plan(6);

-- ─── Fixtures ────────────────────────────────────────────────────────────────
-- UUID prefix d8 to avoid collisions with other test files.

DO $$
DECLARE
  v_buyer_a uuid := 'd8100000-0000-0000-0000-000000000001'::uuid;
  v_buyer_b uuid := 'd8100000-0000-0000-0000-000000000002'::uuid;
  v_doc     uuid := 'd8200000-0000-0000-0000-000000000001'::uuid;
  v_file    uuid := 'd8200000-0000-0000-0000-000000000011'::uuid;
  v_ent_a   uuid := 'd8500000-0000-0000-0000-000000000001'::uuid;
  v_ent_b   uuid := 'd8500000-0000-0000-0000-000000000002'::uuid;
BEGIN
  INSERT INTO public.profiles (id, email, display_name) VALUES
    (v_buyer_a, 'buyer_a_d8@test.invalid', 'Buyer A D8'),
    (v_buyer_b, 'buyer_b_d8@test.invalid', 'Buyer B D8')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth.users (id, email, encrypted_password, role) VALUES
    (v_buyer_a, 'buyer_a_d8@test.invalid', 'x', 'authenticated'),
    (v_buyer_b, 'buyer_b_d8@test.invalid', 'x', 'authenticated')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.documents (id, title, slug, doc_kind, price_cents, status, published_at)
  VALUES (v_doc, 'D8 Test Doc', 'd8-test-doc', 'checklist', 1000, 'published', now())
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.document_files (id, document_id, kind, language, format, file_key, size_bytes, is_current, status)
  VALUES (v_file, v_doc, 'full', 'en', 'pptx', 'docs/en/d8-test.pptx', 1024, true, 'ready')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.entitlements (id, user_id, item_type, source, document_id, language, download_limit, downloads_used)
  VALUES
    (v_ent_a, v_buyer_a, 'document', 'purchase', v_doc, 'en', 1, 0),
    (v_ent_b, v_buyer_b, 'document', 'purchase', v_doc, 'en', 1, 0)
  ON CONFLICT (id) DO NOTHING;

  -- Insert a download_log and download_request for buyer A
  INSERT INTO public.download_logs (entitlement_id, user_id, document_id, document_file_id, ip_hash)
  VALUES (v_ent_a, v_buyer_a, v_doc, v_file, 'testhash_d8_a')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.download_requests (entitlement_id, user_id, status)
  VALUES (v_ent_a, v_buyer_a, 'open')
  ON CONFLICT DO NOTHING;
END;
$$;

-- ─── Helper: set JWT claims to simulate an authenticated buyer ────────────────

CREATE OR REPLACE FUNCTION pg_temp.set_buyer_d8(p_id uuid) RETURNS void AS $$
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', p_id::text, 'role', 'authenticated')::text,
    true
  );
  SET LOCAL role TO authenticated;
END;
$$ LANGUAGE plpgsql;

-- ─── download_logs: a buyer can only read their own rows ─────────────────────

SELECT pg_temp.set_buyer_d8('d8100000-0000-0000-0000-000000000002'::uuid);

SELECT is(
  (
    SELECT count(*)::int
    FROM   public.download_logs
    WHERE  user_id = 'd8100000-0000-0000-0000-000000000001'::uuid
  ),
  0,
  'buyer B cannot see buyer A''s download_logs'
);

SELECT pg_temp.set_buyer_d8('d8100000-0000-0000-0000-000000000001'::uuid);

SELECT is(
  (
    SELECT count(*)::int
    FROM   public.download_logs
    WHERE  user_id = 'd8100000-0000-0000-0000-000000000001'::uuid
  ),
  1,
  'buyer A can see their own download_logs'
);

-- ─── download_requests: a buyer can only read their own rows ─────────────────

SELECT pg_temp.set_buyer_d8('d8100000-0000-0000-0000-000000000002'::uuid);

SELECT is(
  (
    SELECT count(*)::int
    FROM   public.download_requests
    WHERE  user_id = 'd8100000-0000-0000-0000-000000000001'::uuid
  ),
  0,
  'buyer B cannot see buyer A''s download_requests'
);

SELECT pg_temp.set_buyer_d8('d8100000-0000-0000-0000-000000000001'::uuid);

SELECT is(
  (
    SELECT count(*)::int
    FROM   public.download_requests
    WHERE  user_id = 'd8100000-0000-0000-0000-000000000001'::uuid
  ),
  1,
  'buyer A can see their own download_requests'
);

-- ─── download_request_queue: authenticated user cannot read the admin view ────

SELECT throws_ok(
  $$SELECT 1 FROM public.download_request_queue LIMIT 1$$,
  'buyer cannot read download_request_queue view (permission denied)'
);

-- ─── Unauthenticated: no access to download tables ───────────────────────────

SET LOCAL role TO anon;
PERFORM set_config('request.jwt.claims', '{}', true);

SELECT is(
  (SELECT count(*)::int FROM public.download_logs),
  0,
  'unauthenticated user sees no download_logs rows'
);

SELECT * FROM finish();
ROLLBACK;
