-- S-020: Dev seed fixture verification tests (AC6)
-- Runs AFTER seed.dev.sql has been applied. All rows use the 0200xxxx UUID prefix.
-- Run with: supabase test db supabase/tests/seed.dev.test.sql
-- check.sh applies seed.dev.sql (idempotent) before running this file.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;
SELECT * FROM no_plan();

-- ── Profiles and roles ────────────────────────────────────────────────────────

SELECT is(
  (SELECT count(*)::int FROM public.profiles WHERE id::text LIKE '02000010%'),
  4,
  'AC6: 4 dev profiles seeded'
);

SELECT ok(
  EXISTS (SELECT 1 FROM public.user_roles ur
          JOIN public.profiles p ON p.id = ur.user_id
          WHERE p.email = 'admin@dev.invalid' AND ur.role = 'admin'),
  'AC6: dev Admin has admin role'
);

SELECT ok(
  EXISTS (SELECT 1 FROM public.user_roles ur
          JOIN public.profiles p ON p.id = ur.user_id
          WHERE p.email = 'maint@dev.invalid' AND ur.role = 'maintainer'),
  'AC6: dev Maintainer has maintainer role'
);

-- ── Authors ───────────────────────────────────────────────────────────────────

SELECT is(
  (SELECT count(*)::int FROM public.authors WHERE id::text LIKE '02000020%'),
  2,
  'AC6: 2 dev authors seeded'
);

-- ── Articles ──────────────────────────────────────────────────────────────────

SELECT is(
  (SELECT count(*)::int FROM public.articles WHERE id::text LIKE '02000030%'),
  3,
  'AC6: 3 dev articles seeded'
);

-- Article 1 has all 6 block types in its body
SELECT ok(
  (SELECT body FROM public.articles WHERE id = '02000030-0000-0000-0000-000000000001')
    @> '{"type":"doc"}'::jsonb,
  'AC6: article 1 body is a doc node'
);

SELECT ok(
  (SELECT body::text FROM public.articles WHERE id = '02000030-0000-0000-0000-000000000001')
    LIKE '%"type": "image"%',
  'AC6: article 1 body contains image block'
);

SELECT ok(
  (SELECT body::text FROM public.articles WHERE id = '02000030-0000-0000-0000-000000000001')
    LIKE '%"type": "video"%',
  'AC6: article 1 body contains video block'
);

SELECT ok(
  (SELECT body::text FROM public.articles WHERE id = '02000030-0000-0000-0000-000000000001')
    LIKE '%"type": "course"%',
  'AC6: article 1 body contains course block'
);

SELECT ok(
  (SELECT body::text FROM public.articles WHERE id = '02000030-0000-0000-0000-000000000001')
    LIKE '%"type": "document"%',
  'AC6: article 1 body contains document block'
);

SELECT ok(
  (SELECT body::text FROM public.articles WHERE id = '02000030-0000-0000-0000-000000000001')
    LIKE '%"type": "ad"%',
  'AC6: article 1 body contains ad block'
);

-- ── article_refs (4 rows for article 1) ──────────────────────────────────────

SELECT is(
  (SELECT count(*)::int FROM public.article_refs WHERE article_id = '02000030-0000-0000-0000-000000000001'),
  4,
  'AC6: article 1 has 4 article_refs rows'
);

SELECT ok(
  EXISTS (SELECT 1 FROM public.article_refs WHERE article_id = '02000030-0000-0000-0000-000000000001' AND ref_type = 'media'),
  'AC6: article_refs has media ref'
);
SELECT ok(
  EXISTS (SELECT 1 FROM public.article_refs WHERE article_id = '02000030-0000-0000-0000-000000000001' AND ref_type = 'video'),
  'AC6: article_refs has video ref'
);
SELECT ok(
  EXISTS (SELECT 1 FROM public.article_refs WHERE article_id = '02000030-0000-0000-0000-000000000001' AND ref_type = 'course'),
  'AC6: article_refs has course ref'
);
SELECT ok(
  EXISTS (SELECT 1 FROM public.article_refs WHERE article_id = '02000030-0000-0000-0000-000000000001' AND ref_type = 'document'),
  'AC6: article_refs has document ref'
);

-- ── Comments (1 approved + 1 pending) ────────────────────────────────────────

SELECT is(
  (SELECT count(*)::int FROM public.article_comments WHERE id::text LIKE '02000031%'),
  2,
  'AC6: 2 dev comments seeded'
);

SELECT ok(
  EXISTS (SELECT 1 FROM public.article_comments WHERE id::text LIKE '02000031%' AND status = 'approved'),
  'AC6: 1 approved comment seeded'
);
SELECT ok(
  EXISTS (SELECT 1 FROM public.article_comments WHERE id::text LIKE '02000031%' AND status = 'pending'),
  'AC6: 1 pending comment seeded'
);

-- ── Videos (1 youtube_copy + 1 custom thumbnail) ─────────────────────────────

SELECT is(
  (SELECT count(*)::int FROM public.videos WHERE id::text LIKE '02000040%'),
  2,
  'AC6: 2 dev videos seeded'
);

SELECT ok(
  EXISTS (SELECT 1 FROM public.videos WHERE id::text LIKE '02000040%' AND thumbnail_source = 'youtube_copy'),
  'AC6: 1 video with youtube_copy thumbnail'
);
SELECT ok(
  EXISTS (SELECT 1 FROM public.videos WHERE id::text LIKE '02000040%' AND thumbnail_source = 'custom'),
  'AC6: 1 video with custom thumbnail'
);

-- ── Documents + document_files ────────────────────────────────────────────────

SELECT is(
  (SELECT count(*)::int FROM public.documents WHERE id::text LIKE '02000050%'),
  2,
  'AC6: 2 dev documents seeded'
);

SELECT is(
  (SELECT count(*)::int FROM public.document_files WHERE id::text LIKE '02000051%'),
  8,
  'AC6: 8 document_files seeded (3 languages + preview per document)'
);

SELECT ok(
  (SELECT count(*)::int FROM public.document_files
   WHERE document_id = '02000050-0000-0000-0000-000000000001' AND kind = 'full') = 3,
  'AC6: document 1 has 3 full-language files (en, si, ta)'
);

SELECT ok(
  EXISTS (SELECT 1 FROM public.document_files
          WHERE document_id = '02000050-0000-0000-0000-000000000001' AND kind = 'preview'),
  'AC6: document 1 has a preview file'
);

-- ── Banners ───────────────────────────────────────────────────────────────────

SELECT is(
  (SELECT count(*)::int FROM public.banners WHERE id::text LIKE '02000060%'),
  3,
  'AC6: 3 dev banners seeded'
);

SELECT ok(
  (SELECT bool_and('home_top' = ANY(placements)) FROM public.banners WHERE id::text LIKE '02000060%'),
  'AC6: all dev banners have home_top placement'
);

-- ── Coupons (1 percent + 1 fixed) ────────────────────────────────────────────

SELECT is(
  (SELECT count(*)::int FROM public.coupons WHERE id::text LIKE '02000070%'),
  2,
  'AC6: 2 dev coupons seeded'
);

SELECT ok(
  EXISTS (SELECT 1 FROM public.coupons WHERE code = 'DEV10PCT' AND discount_type = 'percent'),
  'AC6: DEV10PCT percent coupon seeded'
);
SELECT ok(
  EXISTS (SELECT 1 FROM public.coupons WHERE code = 'DEV500OFF' AND discount_type = 'fixed'),
  'AC6: DEV500OFF fixed coupon seeded'
);

-- ── Orders: PAID order with entitlements ─────────────────────────────────────

SELECT ok(
  EXISTS (SELECT 1 FROM public.orders WHERE id = '02000080-0000-0000-0000-000000000001' AND status = 'paid'),
  'AC6: dev PAID order exists'
);

SELECT is(
  (SELECT count(*)::int FROM public.entitlements WHERE id::text LIKE '02000082%'),
  2,
  'AC6: 2 entitlements seeded (1 used + 1 unused)'
);

SELECT ok(
  EXISTS (SELECT 1 FROM public.entitlements WHERE id::text LIKE '02000082%' AND downloads_used = 0),
  'AC6: 1 unused entitlement (downloads_used = 0)'
);
SELECT ok(
  EXISTS (SELECT 1 FROM public.entitlements WHERE id::text LIKE '02000082%' AND downloads_used = 1),
  'AC6: 1 used entitlement (downloads_used = 1)'
);

-- ── pending_verification bank order + slip ────────────────────────────────────

SELECT ok(
  EXISTS (SELECT 1 FROM public.orders WHERE id = '02000090-0000-0000-0000-000000000001' AND status = 'pending_verification'),
  'AC6: dev pending_verification bank order exists'
);

SELECT ok(
  EXISTS (SELECT 1 FROM public.bank_transfer_slips
          WHERE order_id = '02000090-0000-0000-0000-000000000001' AND status = 'uploaded'),
  'AC6: bank transfer slip seeded for bank order'
);

-- ── Open download request ─────────────────────────────────────────────────────

SELECT ok(
  EXISTS (SELECT 1 FROM public.download_requests WHERE id = '02000093-0000-0000-0000-000000000001' AND status = 'open'),
  'AC6: open download request seeded'
);

SELECT * FROM finish();
ROLLBACK;
