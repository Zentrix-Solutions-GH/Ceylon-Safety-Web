-- S-085: pgTAP tests for private.claim_download PL/pgSQL function (AC2, AC3, AC6, AC14).
-- Tests the atomic claim transaction: ownership check, limit enforcement, log write,
-- counter increment, and TABLE return value.
-- Run with: supabase test db (requires Docker + local Supabase stack).
--
-- UUID legend (prefix e9 to avoid collisions with other test files):
--   Buyer A:         e9100000-0000-0000-0000-000000000001
--   Buyer B:         e9100000-0000-0000-0000-000000000002
--   Document:        e9200000-0000-0000-0000-000000000001
--   Document file:   e9200000-0000-0000-0000-000000000011
--   Order:           e9300000-0000-0000-0000-000000000001
--   Order item:      e9400000-0000-0000-0000-000000000001
--   Entitlement (1): e9500000-0000-0000-0000-000000000001  limit=1, used=0
--   Entitlement (3): e9500000-0000-0000-0000-000000000002  limit=3, used=1

BEGIN;
SELECT plan(9);

-- UUID legend (additional for AC3 serial-exhaustion simulation):
--   Entitlement (AC3): e9500000-0000-0000-0000-000000000003  limit=1, used=0

-- ── Fixtures ──────────────────────────────────────────────────────────────────

INSERT INTO public.profiles (id, email, display_name, first_name, last_name)
VALUES
  ('e9100000-0000-0000-0000-000000000001', 'buyer_a@e9.invalid', 'Buyer A E9', 'A', 'E9'),
  ('e9100000-0000-0000-0000-000000000002', 'buyer_b@e9.invalid', 'Buyer B E9', 'B', 'E9')
ON CONFLICT DO NOTHING;

INSERT INTO public.documents (id, title, slug, doc_kind, price_cents, status, published_at)
VALUES (
  'e9200000-0000-0000-0000-000000000001',
  'E9 Test Doc', 'e9-test-doc', 'checklist', 50000, 'published', now()
)
ON CONFLICT DO NOTHING;

INSERT INTO public.document_files (
  id, document_id, kind, language, format,
  file_key, size_bytes, is_current, status
)
VALUES (
  'e9200000-0000-0000-0000-000000000011',
  'e9200000-0000-0000-0000-000000000001',
  'full', 'en', 'pptx',
  'docs/en/e9-test-doc.pptx', 102400, true, 'ready'
)
ON CONFLICT DO NOTHING;

INSERT INTO public.entitlements (
  id, user_id, item_type, source, document_id, language,
  download_limit, downloads_used
)
VALUES
  -- Entitlement with limit=1, used=0 (can claim once)
  (
    'e9500000-0000-0000-0000-000000000001',
    'e9100000-0000-0000-0000-000000000001',
    'document', 'purchase',
    'e9200000-0000-0000-0000-000000000001',
    'en', 1, 0
  ),
  -- Entitlement with limit=3, used=1 (can still claim; AC14 limit > 1)
  (
    'e9500000-0000-0000-0000-000000000002',
    'e9100000-0000-0000-0000-000000000001',
    'document', 'purchase',
    'e9200000-0000-0000-0000-000000000001',
    'en', 3, 1
  ),
  -- Entitlement for AC3 serial-exhaustion test (limit=1, used=0)
  (
    'e9500000-0000-0000-0000-000000000003',
    'e9100000-0000-0000-0000-000000000001',
    'document', 'purchase',
    'e9200000-0000-0000-0000-000000000001',
    'en', 1, 0
  )
ON CONFLICT DO NOTHING;

-- ── AC2: happy path — returns file_key and log_id ─────────────────────────────

SELECT ok(
  (
    SELECT count(*)::int > 0
    FROM   private.claim_download(
             'e9100000-0000-0000-0000-000000000001'::uuid,
             'e9500000-0000-0000-0000-000000000001'::uuid,
             'testhash1'
           )
    WHERE  file_key = 'docs/en/e9-test-doc.pptx'
  ),
  'claim_download returns the correct file_key on success'
);

SELECT ok(
  (
    SELECT (log_id > 0)
    FROM   private.claim_download(
             'e9100000-0000-0000-0000-000000000001'::uuid,
             'e9500000-0000-0000-0000-000000000002'::uuid,
             'testhash1b'
           )
    LIMIT 1
  ),
  'claim_download returns a positive log_id'
);

-- AC2: downloads_used incremented after claim
SELECT is(
  (SELECT downloads_used FROM public.entitlements
   WHERE id = 'e9500000-0000-0000-0000-000000000001'),
  1,  -- called once above
  'downloads_used incremented on each successful claim'
);

-- AC14: limit=3, used=1 → still succeeds (not at limit)
SELECT ok(
  (
    SELECT count(*)::int > 0
    FROM   private.claim_download(
             'e9100000-0000-0000-0000-000000000001'::uuid,
             'e9500000-0000-0000-0000-000000000002'::uuid,
             'testhash2'
           )
    WHERE  file_key = 'docs/en/e9-test-doc.pptx'
  ),
  'AC14: claim succeeds when downloads_used < download_limit (limit=3, used=1)'
);

-- AC14: limit=3, used=3 → download_limit_reached
-- entitlement ...002: started used=1, log_id test used it (used=2),
-- AC14 success test used it (used=3 = limit). Next call must raise.

SELECT throws_ok(
  $$
    SELECT private.claim_download(
      'e9100000-0000-0000-0000-000000000001'::uuid,
      'e9500000-0000-0000-0000-000000000002'::uuid,
      'testhash4'
    )
  $$,
  '23001',
  'ceylonsafety: download_limit_reached',
  'AC14: download_limit_reached when downloads_used = download_limit (limit=3)'
);

-- AC6: wrong user raises insufficient_privilege
SELECT throws_ok(
  $$
    SELECT private.claim_download(
      'e9100000-0000-0000-0000-000000000002'::uuid,
      'e9500000-0000-0000-0000-000000000001'::uuid,
      'testhash5'
    )
  $$,
  '42501',
  'ceylonsafety: entitlement does not belong to this user',
  'AC6: claim_download raises insufficient_privilege for wrong user'
);

-- AC6: revoked entitlement raises restrict_violation
UPDATE public.entitlements
SET revoked_at = now()
WHERE id = 'e9500000-0000-0000-0000-000000000001';

SELECT throws_ok(
  $$
    SELECT private.claim_download(
      'e9100000-0000-0000-0000-000000000001'::uuid,
      'e9500000-0000-0000-0000-000000000001'::uuid,
      'testhash6'
    )
  $$,
  '23001',
  'ceylonsafety: entitlement is revoked',
  'AC6: claim_download raises restrict_violation for revoked entitlement'
);

-- AC3: serial exhaustion on limit=1 entitlement — first call succeeds, second raises.
-- True concurrent DB-level serialisation is enforced by FOR UPDATE; this test
-- validates that the row lock prevents a double-claim in the same session by
-- exhausting the entitlement and asserting the second call raises.

SELECT ok(
  (
    SELECT count(*)::int > 0
    FROM   private.claim_download(
             'e9100000-0000-0000-0000-000000000001'::uuid,
             'e9500000-0000-0000-0000-000000000003'::uuid,
             'testhash_ac3_first'
           )
    WHERE  file_key = 'docs/en/e9-test-doc.pptx'
  ),
  'AC3: first claim on limit=1 entitlement succeeds'
);

SELECT throws_ok(
  $$
    SELECT private.claim_download(
      'e9100000-0000-0000-0000-000000000001'::uuid,
      'e9500000-0000-0000-0000-000000000003'::uuid,
      'testhash_ac3_second'
    )
  $$,
  '23001',
  'ceylonsafety: download_limit_reached',
  'AC3: second claim on limit=1 entitlement raises download_limit_reached (FOR UPDATE serialises)'
);

SELECT * FROM finish();
ROLLBACK;
