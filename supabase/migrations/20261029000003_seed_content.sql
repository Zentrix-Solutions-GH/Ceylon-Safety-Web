-- S-020: Seed content migration
-- Inserts: categories (8), pages (6) + page_revisions (6),
--          role_permissions (18 for admin), trainers (3), courses (4).
-- All inserts are ON CONFLICT DO NOTHING (idempotent).
-- This migration runs before seed.sql, so categories are inserted here so
-- courses can reference them via FK in the same migration.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Categories ───────────────────────────────────────────────────────────────

INSERT INTO public.categories (slug, name, applies_to, order_index) VALUES
  ('workplace-safety',    'Workplace Safety',    ARRAY['article','video','document','course'], 1),
  ('fire-safety',         'Fire Safety',         ARRAY['article','video','document','course'], 2),
  ('first-aid',           'First Aid',           ARRAY['article','video','document','course'], 3),
  ('electrical-safety',   'Electrical Safety',   ARRAY['article','video','document','course'], 4),
  ('construction-safety', 'Construction Safety', ARRAY['article','video','document','course'], 5),
  ('food-safety',         'Food Safety',         ARRAY['article','video','document','course'], 6),
  ('chemical-safety',     'Chemical Safety',     ARRAY['article','video','document','course'], 7),
  ('occupational-health', 'Occupational Health', ARRAY['article','video','document','course'], 8)
ON CONFLICT (slug) DO NOTHING;

-- ── Pages + page_revisions (6 seed pages, all locale en, draft) ──────────────
-- published_at IS NULL = draft. Orders cannot be created until terms and
-- refund-policy have a revision; both are inserted here.

DO $$
DECLARE
  v_terms_id   uuid := gen_random_uuid();
  v_privacy_id uuid := gen_random_uuid();
  v_refund_id  uuid := gen_random_uuid();
  v_discl_id   uuid := gen_random_uuid();
  v_intro_id   uuid := gen_random_uuid();
  v_services_id uuid := gen_random_uuid();
BEGIN

  INSERT INTO public.pages (id, locale, slug, title) VALUES
    (v_terms_id,    'en', 'terms',                 'Terms & Conditions'),
    (v_privacy_id,  'en', 'privacy',               'Privacy Policy'),
    (v_refund_id,   'en', 'refund-policy',          'Refund Policy'),
    (v_discl_id,    'en', 'disclaimer',             'Disclaimer'),
    (v_intro_id,    'en', 'contact-coach-intro',    'Contact Our Training Team'),
    (v_services_id, 'en', 'contact-coach-services', 'Our Training Services')
  ON CONFLICT (locale, slug) DO NOTHING;

  -- Resolve actual IDs in case the pages already existed (ON CONFLICT skipped inserts)
  SELECT id INTO v_terms_id    FROM public.pages WHERE locale = 'en' AND slug = 'terms';
  SELECT id INTO v_privacy_id  FROM public.pages WHERE locale = 'en' AND slug = 'privacy';
  SELECT id INTO v_refund_id   FROM public.pages WHERE locale = 'en' AND slug = 'refund-policy';
  SELECT id INTO v_discl_id    FROM public.pages WHERE locale = 'en' AND slug = 'disclaimer';
  SELECT id INTO v_intro_id    FROM public.pages WHERE locale = 'en' AND slug = 'contact-coach-intro';
  SELECT id INTO v_services_id FROM public.pages WHERE locale = 'en' AND slug = 'contact-coach-services';

  INSERT INTO public.page_revisions (page_id, version, title, body, published_at) VALUES

    (v_terms_id, 1, 'Terms & Conditions',
     jsonb_build_object('type','doc','content', jsonb_build_array(
       jsonb_build_object('type','paragraph','content', jsonb_build_array(
         jsonb_build_object('type','text','text',
           '[DRAFT – awaiting client final text] Welcome to CeylonSafety. By accessing or using our website and purchasing downloadable documents, you agree to be bound by these Terms & Conditions. All content is provided for informational purposes and does not constitute professional legal or safety advice. Documents are sold as digital downloads and are subject to our refund policy. Unauthorised reproduction or distribution of purchased materials is prohibited. We reserve the right to update these terms at any time.')
       ))
     )), NULL),

    (v_privacy_id, 1, 'Privacy Policy',
     jsonb_build_object('type','doc','content', jsonb_build_array(
       jsonb_build_object('type','paragraph','content', jsonb_build_array(
         jsonb_build_object('type','text','text',
           '[DRAFT – awaiting client final text] CeylonSafety collects personal information (name, email, billing details) solely for the purpose of providing our services. We do not sell or share your data with third parties except as required to process payments (PayHere) or send transactional emails (Resend). You may request deletion of your account and associated data at any time by contacting us. We use cookies to improve site performance and may use analytics tools to understand site usage. By using our site you consent to this policy.')
       ))
     )), NULL),

    (v_refund_id, 1, 'Refund Policy',
     jsonb_build_object('type','doc','content', jsonb_build_array(
       jsonb_build_object('type','paragraph','content', jsonb_build_array(
         jsonb_build_object('type','text','text',
           '[DRAFT – awaiting client final text] All sales of digital documents on CeylonSafety are final. Because our products are digital downloads, we do not offer refunds once a file has been accessed or downloaded. If you experience a technical issue with your download, please contact us within 7 days of purchase and we will do our best to resolve it. Exceptions to this policy may be made at our sole discretion.')
       ))
     )), NULL),

    (v_discl_id, 1, 'Disclaimer',
     jsonb_build_object('type','doc','content', jsonb_build_array(
       jsonb_build_object('type','paragraph','content', jsonb_build_array(
         jsonb_build_object('type','text','text',
           '[DRAFT – awaiting client final text] The information and documents provided on CeylonSafety are intended as general guidance for health and safety awareness in Sri Lanka. They do not constitute professional legal, medical or engineering advice. Always consult a qualified health and safety professional before implementing any safety measure. CeylonSafety accepts no liability for any loss or damage arising from reliance on materials published on this site.')
       ))
     )), NULL),

    (v_intro_id, 1, 'Contact Our Training Team',
     jsonb_build_object('type','doc','content', jsonb_build_array(
       jsonb_build_object('type','paragraph','content', jsonb_build_array(
         jsonb_build_object('type','text','text',
           '[DRAFT – awaiting client final text] CeylonSafety connects you with experienced health and safety trainers across Sri Lanka. Whether you need on-site training for your team, a customised workshop, or certification support, our trainers are ready to help. Get in touch using the form below and we will match you with a trainer suited to your needs.')
       ))
     )), NULL),

    (v_services_id, 1, 'Our Training Services',
     jsonb_build_object('type','doc','content', jsonb_build_array(
       jsonb_build_object('type','paragraph','content', jsonb_build_array(
         jsonb_build_object('type','text','text',
           '[DRAFT – awaiting client final text] Our trainers offer the following services: Fire Safety & Evacuation Drills, First Aid & Emergency Response, Construction Site Safety, Electrical Safety Awareness, Food Safety & Hygiene, Chemical Handling & COSHH, Workplace Hazard Identification, and Toolbox Talk facilitation. Training can be delivered on-site at your premises or at an approved venue. All programmes can be tailored to your industry and workforce size.')
       ))
     )), NULL)

  ON CONFLICT (page_id, version) DO NOTHING;

END $$;

-- ── role_permissions — admin (18 rows) ───────────────────────────────────────
-- No rows for maintainer (deny by default).
-- Super Admin bypasses this table in has_permission(); no row needed.

INSERT INTO public.role_permissions (role, action) VALUES
  ('admin', 'articles.*'),
  ('admin', 'videos.*'),
  ('admin', 'authors.*'),
  ('admin', 'media.upload'),
  ('admin', 'comments.moderate'),
  ('admin', 'documents.*'),
  ('admin', 'courses.*'),
  ('admin', 'trainers.*'),
  ('admin', 'pages.publish'),
  ('admin', 'settings.site'),
  ('admin', 'banners.read'),
  ('admin', 'banners.write'),
  ('admin', 'coupons.*'),
  ('admin', 'bank_transfers.review'),
  ('admin', 'download_requests.review'),
  ('admin', 'orders.read'),
  ('admin', 'users.read'),
  ('admin', 'users.suspend')
ON CONFLICT (role, action) DO NOTHING;

-- ── Trainers (3 sample Sri Lankan trainers) ──────────────────────────────────
-- Consent confirmed by client (required before go-live).
-- status and consent are not columns on this table; confirmation is noted here.

INSERT INTO public.trainers (name, position, bio, email, phone, slug, order_index) VALUES
  (
    'Nimal Perera',
    'Senior HSE Consultant',
    'Nimal has over 15 years of experience in health and safety management across manufacturing, construction and hospitality sectors in Sri Lanka. He holds NEBOSH IGC and is a registered safety practitioner.',
    'nimal.perera@example.lk',
    '+94 77 123 4567',
    'nimal-perera',
    1
  ),
  (
    'Chaminda Silva',
    'Workplace Safety Officer',
    'Chaminda specialises in fire safety, hazard identification and toolbox talk facilitation. He has trained over 500 workers across Colombo and the Western Province.',
    'chaminda.silva@example.lk',
    '+94 71 234 5678',
    'chaminda-silva',
    2
  ),
  (
    'Priyanka Fernando',
    'First Aid & Emergency Response Trainer',
    'Priyanka is a certified Red Cross first aid instructor and occupational health nurse with experience in food processing, retail and office environments.',
    'priyanka.fernando@example.lk',
    '+94 76 345 6789',
    'priyanka-fernando',
    3
  )
ON CONFLICT (slug) DO NOTHING;

-- ── Courses (4 sample, all coming soon) ──────────────────────────────────────

-- UUIDs are fixed so seed.dev.sql article body blocks can reference them.
INSERT INTO public.courses (id, slug, title, description, pricing_type, is_coming_soon, status, category_id) VALUES
  (
    '02000056-0000-0000-0000-000000000001',
    'fire-safety-evacuation-training',
    'Fire Safety & Evacuation Training',
    'Learn how to prevent fires, use extinguishers correctly, and conduct safe evacuations. Suitable for all industries.',
    'enquire',
    true,
    'draft',
    (SELECT id FROM public.categories WHERE slug = 'fire-safety')
  ),
  (
    '02000056-0000-0000-0000-000000000002',
    'first-aid-emergency-response',
    'First Aid & Emergency Response',
    'Hands-on first aid certification covering CPR, wound care, burns treatment and emergency protocols.',
    'enquire',
    true,
    'draft',
    (SELECT id FROM public.categories WHERE slug = 'first-aid')
  ),
  (
    '02000056-0000-0000-0000-000000000003',
    'construction-site-safety',
    'Construction Site Safety',
    'Covers working at height, PPE selection, excavation safety, scaffolding and site induction requirements.',
    'enquire',
    true,
    'draft',
    (SELECT id FROM public.categories WHERE slug = 'construction-safety')
  ),
  (
    '02000056-0000-0000-0000-000000000004',
    'workplace-hazard-identification',
    'Workplace Hazard Identification',
    'Train your team to spot and report hazards before they cause injury. Includes risk assessment basics and HIRA methodology.',
    'enquire',
    true,
    'draft',
    (SELECT id FROM public.categories WHERE slug = 'workplace-safety')
  )
ON CONFLICT (locale, slug) WHERE deleted_at IS NULL DO NOTHING;
