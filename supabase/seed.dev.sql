-- Sample content for local development only, NEVER run on production
-- Backend owner: S-020
--
-- How to run: supabase db reset (applies migrations + seed.sql + this file on local)
-- Guard: aborts if app.environment != 'development' (set in supabase/config.toml
--        for local; set APP_ENV in CI workflow).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Guard: refuse to run on production (AC7, EC3) ────────────────────────────

DO $$
BEGIN
  IF current_setting('app.environment', true) IS DISTINCT FROM 'development' THEN
    RAISE EXCEPTION
      'seed.dev.sql is for development only. '
      'Set app.environment=development (supabase/config.toml [db.settings]) before running. '
      'Aborting — no changes made.';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Everything below only runs in a development database.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Test profiles ─────────────────────────────────────────────────────────────
-- UUIDs use prefix 0200 so they cannot collide with test-suite fixtures (0210x).

INSERT INTO public.profiles (id, display_name, email, status) VALUES
  ('02000010-0000-0000-0000-000000000001', 'Dev Customer A',   'cust.a@dev.invalid',   'active'),
  ('02000010-0000-0000-0000-000000000002', 'Dev Customer B',   'cust.b@dev.invalid',   'active'),
  ('02000010-0000-0000-0000-000000000003', 'Dev Admin',        'admin@dev.invalid',    'active'),
  ('02000010-0000-0000-0000-000000000004', 'Dev Maintainer',   'maint@dev.invalid',    'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role, granted_by) VALUES
  ('02000010-0000-0000-0000-000000000003', 'admin',      '02000010-0000-0000-0000-000000000003'),
  ('02000010-0000-0000-0000-000000000004', 'maintainer', '02000010-0000-0000-0000-000000000003')
ON CONFLICT DO NOTHING;

-- ── Authors ───────────────────────────────────────────────────────────────────

INSERT INTO public.authors (id, name, bio, slug) VALUES
  ('02000020-0000-0000-0000-000000000001', 'Dev Author One', 'Sample author for development.', 'dev-author-one'),
  ('02000020-0000-0000-0000-000000000002', 'Dev Author Two', 'Another sample author.',         'dev-author-two')
ON CONFLICT (slug) DO NOTHING;

-- ── Articles (3 sample, covering different body block types) ──────────────────

INSERT INTO public.articles (
  id, locale, slug, title, summary, author_id,
  category_id, status, published_at, body, body_text, body_version
) VALUES
  (
    '02000030-0000-0000-0000-000000000001',
    'en',
    'sample-fire-safety-tips',
    'Fire Safety Tips for the Workplace',
    'A practical guide to preventing and responding to workplace fires.',
    '02000020-0000-0000-0000-000000000001',
    (SELECT id FROM public.categories WHERE slug = 'fire-safety'),
    'published',
    now() - interval '7 days',
    -- Body with all 6 block types: text, image, video, course, document, ad
    jsonb_build_object('type','doc','content', jsonb_build_array(
      jsonb_build_object('type','paragraph','content', jsonb_build_array(
        jsonb_build_object('type','text','text','Fire safety is a critical concern for every workplace in Sri Lanka. This article covers fire prevention, extinguisher selection and evacuation planning.')
      )),
      jsonb_build_object('type','image','attrs', jsonb_build_object(
        'node_id', 'node-img-01',
        'key',     'images/articles/02000030-0000-0000-0000-000000000001/fire-extinguisher.webp',
        'alt',     'A red fire extinguisher mounted on a wall',
        'width',   1200,
        'height',  800
      )),
      jsonb_build_object('type','paragraph','content', jsonb_build_array(
        jsonb_build_object('type','text','text','Watch the video below to see the PASS technique demonstrated step by step.')
      )),
      jsonb_build_object('type','video','attrs', jsonb_build_object(
        'node_id',    'node-vid-01',
        'video_id',   '02000040-0000-0000-0000-000000000001'
      )),
      jsonb_build_object('type','paragraph','content', jsonb_build_array(
        jsonb_build_object('type','text','text','Want hands-on training? Enroll in our coming-soon course.')
      )),
      jsonb_build_object('type','course','attrs', jsonb_build_object(
        'node_id',   'node-crs-01',
        'course_id', '02000056-0000-0000-0000-000000000001'
      )),
      jsonb_build_object('type','paragraph','content', jsonb_build_array(
        jsonb_build_object('type','text','text','Download our fire safety checklist to conduct your own inspection.')
      )),
      jsonb_build_object('type','document','attrs', jsonb_build_object(
        'node_id',     'node-doc-01',
        'document_id', '02000050-0000-0000-0000-000000000001'
      )),
      jsonb_build_object('type','ad','attrs', jsonb_build_object(
        'node_id', 'node-ad-01',
        'slot',    'in_article'
      ))
    )),
    'Fire safety is a critical concern for every workplace in Sri Lanka.',
    1
  ),
  (
    '02000030-0000-0000-0000-000000000002',
    'en',
    'sample-first-aid-basics',
    'First Aid Basics Every Employee Should Know',
    'Essential first aid knowledge for common workplace injuries.',
    '02000020-0000-0000-0000-000000000002',
    (SELECT id FROM public.categories WHERE slug = 'first-aid'),
    'published',
    now() - interval '3 days',
    jsonb_build_object('type','doc','content', jsonb_build_array(
      jsonb_build_object('type','paragraph','content', jsonb_build_array(
        jsonb_build_object('type','text','text','Knowing basic first aid can save lives. This article explains how to respond to cuts, burns, fractures and cardiac emergencies in a Sri Lankan workplace setting.')
      ))
    )),
    'Knowing basic first aid can save lives.',
    1
  ),
  (
    '02000030-0000-0000-0000-000000000003',
    'en',
    'sample-construction-hazards',
    'Top Hazards on Sri Lankan Construction Sites',
    'Identifying and controlling the most common construction site hazards.',
    '02000020-0000-0000-0000-000000000001',
    (SELECT id FROM public.categories WHERE slug = 'construction-safety'),
    'draft',
    NULL,
    jsonb_build_object('type','doc','content', jsonb_build_array(
      jsonb_build_object('type','paragraph','content', jsonb_build_array(
        jsonb_build_object('type','text','text','Construction sites present unique hazards. This draft article covers working at height, excavation risks, PPE requirements and daily site inspections.')
      ))
    )),
    'Construction sites present unique hazards.',
    1
  )
ON CONFLICT (locale, slug) WHERE deleted_at IS NULL DO NOTHING;

-- ── media_assets (sample image used in article 1 body block) ─────────────────

INSERT INTO public.media_assets (id, bucket, status, file_key, kind, mime_type, width, height, alt_text) VALUES
  (
    '02000021-0000-0000-0000-000000000001',
    'public',
    'ready',
    'images/articles/02000030-0000-0000-0000-000000000001/fire-extinguisher.webp',
    'image',
    'image/webp',
    1200,
    800,
    'A red fire extinguisher mounted on a wall'
  )
ON CONFLICT (file_key) DO NOTHING;

-- ── article_refs for article 1 (matches the body block types above) ──────────
-- ref_type 'media' for the image, 'video', 'course', 'document' for the others.
-- The 'ad' block type does not produce an article_refs row (no stable ID to track).

INSERT INTO public.article_refs (id, article_id, node_id, ref_type, ref_id) VALUES
  -- image block → media asset
  ('02000035-0000-0000-0000-000000000001', '02000030-0000-0000-0000-000000000001',
   'node-img-01', 'media',
   '02000021-0000-0000-0000-000000000001'),
  -- video block → video row
  ('02000035-0000-0000-0000-000000000002', '02000030-0000-0000-0000-000000000001',
   'node-vid-01', 'video',
   '02000040-0000-0000-0000-000000000001'),
  -- course block → course row (fixed UUID from migration)
  ('02000035-0000-0000-0000-000000000004', '02000030-0000-0000-0000-000000000001',
   'node-crs-01', 'course',
   '02000056-0000-0000-0000-000000000001'),
  -- document block → document row
  ('02000035-0000-0000-0000-000000000003', '02000030-0000-0000-0000-000000000001',
   'node-doc-01', 'document',
   '02000050-0000-0000-0000-000000000001')
ON CONFLICT (article_id, node_id, ref_type, ref_id, COALESCE(phrase, '')) DO NOTHING;

-- ── Article comments (one pending, one approved) ──────────────────────────────

INSERT INTO public.article_comments (id, article_id, user_id, body, status) VALUES
  (
    '02000031-0000-0000-0000-000000000001',
    '02000030-0000-0000-0000-000000000001',
    '02000010-0000-0000-0000-000000000001',
    'Very helpful article. We used this as the basis for our fire drill last month.',
    'approved'
  ),
  (
    '02000031-0000-0000-0000-000000000002',
    '02000030-0000-0000-0000-000000000001',
    '02000010-0000-0000-0000-000000000002',
    'Could you add more information about fire extinguisher types?',
    'pending'
  )
ON CONFLICT (id) DO NOTHING;

-- ── Videos (2 sample) ─────────────────────────────────────────────────────────

INSERT INTO public.videos (
  id, locale, title, description, youtube_id, thumbnail_key,
  thumbnail_source, category_id, status, published_at
) VALUES
  (
    '02000040-0000-0000-0000-000000000001',
    'en',
    'How to Use a Fire Extinguisher',
    'Step-by-step demonstration of the PASS technique for fire extinguisher use.',
    'dQw4w9WgXcQ',
    'images/videos/02000040-0000-0000-0000-000000000001/thumb.webp',
    'youtube_copy',
    (SELECT id FROM public.categories WHERE slug = 'fire-safety'),
    'published',
    now() - interval '5 days'
  ),
  (
    '02000040-0000-0000-0000-000000000002',
    'en',
    'CPR for Beginners',
    'Learn the basics of cardiopulmonary resuscitation with this step-by-step guide.',
    'dQw4w9WgXcQ',
    'images/videos/02000040-0000-0000-0000-000000000002/custom-thumb.webp',
    'custom',
    (SELECT id FROM public.categories WHERE slug = 'first-aid'),
    'published',
    now() - interval '2 days'
  )
ON CONFLICT DO NOTHING;

-- ── Documents (2 sample, each with 3 language files) ─────────────────────────

INSERT INTO public.documents (
  id, slug, title, description, doc_kind, file_format,
  price_cents, category_id, status, published_at
) VALUES
  (
    '02000050-0000-0000-0000-000000000001',
    'fire-safety-checklist',
    'Fire Safety Inspection Checklist',
    'A comprehensive monthly fire safety checklist for Sri Lankan workplaces. Covers extinguishers, exits, alarms and equipment.',
    'checklist',
    'pptx',
    99500,
    (SELECT id FROM public.categories WHERE slug = 'fire-safety'),
    'published',
    now() - interval '10 days'
  ),
  (
    '02000050-0000-0000-0000-000000000002',
    'first-aid-toolbox-talk',
    'First Aid Toolbox Talk',
    'A ready-to-deliver toolbox talk on workplace first aid, designed for 15-minute pre-shift briefings.',
    'toolbox_talk',
    'pptx',
    79500,
    (SELECT id FROM public.categories WHERE slug = 'first-aid'),
    'published',
    now() - interval '8 days'
  )
ON CONFLICT (slug) WHERE deleted_at IS NULL DO NOTHING;

INSERT INTO public.document_files (id, document_id, language, kind, file_key, version, is_current, status) VALUES
  ('02000051-0000-0000-0000-000000000001', '02000050-0000-0000-0000-000000000001', 'en', 'full',    'documents/02000050-0000-0000-0000-000000000001/en/v1/fire-safety-checklist.pptx', 1, true, 'ready'),
  ('02000051-0000-0000-0000-000000000002', '02000050-0000-0000-0000-000000000001', 'si', 'full',    'documents/02000050-0000-0000-0000-000000000001/si/v1/fire-safety-checklist-si.pptx', 1, true, 'ready'),
  ('02000051-0000-0000-0000-000000000003', '02000050-0000-0000-0000-000000000001', 'ta', 'full',    'documents/02000050-0000-0000-0000-000000000001/ta/v1/fire-safety-checklist-ta.pptx', 1, true, 'ready'),
  ('02000051-0000-0000-0000-000000000004', '02000050-0000-0000-0000-000000000001', 'en', 'preview', 'previews/02000050-0000-0000-0000-000000000001/preview.pptx', 1, true, 'ready'),
  ('02000051-0000-0000-0000-000000000005', '02000050-0000-0000-0000-000000000002', 'en', 'full',    'documents/02000050-0000-0000-0000-000000000002/en/v1/first-aid-toolbox-talk.pptx', 1, true, 'ready'),
  ('02000051-0000-0000-0000-000000000006', '02000050-0000-0000-0000-000000000002', 'si', 'full',    'documents/02000050-0000-0000-0000-000000000002/si/v1/first-aid-toolbox-talk-si.pptx', 1, true, 'ready'),
  ('02000051-0000-0000-0000-000000000007', '02000050-0000-0000-0000-000000000002', 'ta', 'full',    'documents/02000050-0000-0000-0000-000000000002/ta/v1/first-aid-toolbox-talk-ta.pptx', 1, true, 'ready'),
  ('02000051-0000-0000-0000-000000000008', '02000050-0000-0000-0000-000000000002', 'en', 'preview', 'previews/02000050-0000-0000-0000-000000000002/preview.pptx', 1, true, 'ready')
ON CONFLICT (id) DO NOTHING;

-- ── Banners (3 home_top banners) ─────────────────────────────────────────────

INSERT INTO public.banners (id, name, image_key, alt_text, link_url, placement, is_active) VALUES
  (
    '02000060-0000-0000-0000-000000000001',
    'Sample Banner 1',
    'images/banners/sample-banner-1.webp',
    'Safety training services in Sri Lanka',
    'https://ceylonsafety.com/contact-coach',
    'home_top',
    true
  ),
  (
    '02000060-0000-0000-0000-000000000002',
    'Sample Banner 2',
    'images/banners/sample-banner-2.webp',
    'Download health and safety documents',
    'https://ceylonsafety.com/documents',
    'home_top',
    true
  ),
  (
    '02000060-0000-0000-0000-000000000003',
    'Sample Banner 3',
    'images/banners/sample-banner-3.webp',
    'Fire safety resources for Sri Lankan businesses',
    'https://ceylonsafety.com/documents?category=fire-safety',
    'home_top',
    false
  )
ON CONFLICT (id) DO NOTHING;

-- ── Coupons (one percent, one fixed) ─────────────────────────────────────────

INSERT INTO public.coupons (id, code, coupon_type, discount_value, is_active, expires_at) VALUES
  (
    '02000070-0000-0000-0000-000000000001',
    'DEV10PCT',
    'percent',
    10,
    true,
    now() + interval '1 year'
  ),
  (
    '02000070-0000-0000-0000-000000000002',
    'DEV500OFF',
    'fixed',
    50000,
    true,
    now() + interval '1 year'
  )
ON CONFLICT (code) DO NOTHING;

-- ── A customer with a PAID order (one used + one unused entitlement) ──────────

INSERT INTO public.orders (
  id, user_id, status, subtotal_cents, discount_cents, total_cents,
  payment_method, terms_accepted_at, finalized_at
) VALUES (
  '02000080-0000-0000-0000-000000000001',
  '02000010-0000-0000-0000-000000000001',
  'paid',
  99500, 0, 99500,
  'card',
  now() - interval '5 days',
  now() - interval '5 days'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.order_items (
  id, order_id, document_id, language, unit_price_cents, quantity
) VALUES (
  '02000081-0000-0000-0000-000000000001',
  '02000080-0000-0000-0000-000000000001',
  '02000050-0000-0000-0000-000000000001',
  'en',
  99500,
  1
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.entitlements (
  id, user_id, order_item_id, document_id, language,
  download_limit, downloads_used, source
) VALUES
  -- Unused entitlement
  (
    '02000082-0000-0000-0000-000000000001',
    '02000010-0000-0000-0000-000000000001',
    '02000081-0000-0000-0000-000000000001',
    '02000050-0000-0000-0000-000000000001',
    'en',
    1, 0, 'purchase'
  ),
  -- Used entitlement (simulate a second purchase for same customer)
  (
    '02000082-0000-0000-0000-000000000002',
    '02000010-0000-0000-0000-000000000001',
    '02000081-0000-0000-0000-000000000001',
    '02000050-0000-0000-0000-000000000001',
    'si',
    1, 1, 'purchase'
  )
ON CONFLICT (id) DO NOTHING;

-- ── A customer with a pending_verification bank order + uploaded slip ─────────

INSERT INTO public.orders (
  id, user_id, status, subtotal_cents, discount_cents, total_cents,
  payment_method, terms_accepted_at
) VALUES (
  '02000090-0000-0000-0000-000000000001',
  '02000010-0000-0000-0000-000000000002',
  'pending_verification',
  79500, 0, 79500,
  'bank_transfer',
  now() - interval '1 day'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.order_items (
  id, order_id, document_id, language, unit_price_cents, quantity
) VALUES (
  '02000091-0000-0000-0000-000000000001',
  '02000090-0000-0000-0000-000000000001',
  '02000050-0000-0000-0000-000000000002',
  'en',
  79500,
  1
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.bank_transfer_slips (
  id, order_id, uploaded_by, file_key, status
) VALUES (
  '02000092-0000-0000-0000-000000000001',
  '02000090-0000-0000-0000-000000000001',
  '02000010-0000-0000-0000-000000000002',
  'slips/02000090-0000-0000-0000-000000000001/slip-dev.jpg',
  'pending'
) ON CONFLICT (id) DO NOTHING;

-- ── An open download request ──────────────────────────────────────────────────

INSERT INTO public.download_requests (
  id, entitlement_id, user_id, reason, status
) VALUES (
  '02000093-0000-0000-0000-000000000001',
  '02000082-0000-0000-0000-000000000001',
  '02000010-0000-0000-0000-000000000001',
  'I accidentally deleted my download and need to re-access it.',
  'open'
) ON CONFLICT (id) DO NOTHING;
