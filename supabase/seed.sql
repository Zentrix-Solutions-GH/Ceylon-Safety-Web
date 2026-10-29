-- Production seed: categories, setting keys, page drafts
-- Backend owner: S-020
-- Run by: supabase db reset (after migrations) on local; manually on production.
-- All inserts are ON CONFLICT DO NOTHING (idempotent).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Categories (AC1) ─────────────────────────────────────────────────────────
-- Also inserted in migration 20261029000003_seed_content.sql so that courses
-- can reference them. ON CONFLICT DO NOTHING makes this idempotent.

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

-- ── site_settings (AC2) ──────────────────────────────────────────────────────
-- is_public rules:
--   site group   — public=true except: default_download_limit, bank_order_expiry_days,
--                  bank_order_warning_days, staff_notification_emails (private)
--   contact      — all public
--   analytics    — all public
--   ads          — all public
--   business     — all private except bank_account_details (public per schema note)
--   system       — all private

INSERT INTO public.site_settings (key, value, is_public, setting_group) VALUES

  -- site group
  ('counters_min_visible',       NULL,           true,  'site'),
  ('counters_rounding',          NULL,           true,  'site'),
  ('bulk_contact_note',          NULL,           true,  'site'),
  ('bulk_contact_phone',         NULL,           true,  'site'),
  ('footer_business_name',       NULL,           true,  'site'),
  ('footer_registration_no',     NULL,           true,  'site'),
  ('default_download_limit',     '1'::jsonb,     false, 'site'),
  ('bank_order_expiry_days',     '7'::jsonb,     false, 'site'),
  ('bank_order_warning_days',    '1'::jsonb,     false, 'site'),
  ('staff_notification_emails',  NULL,           false, 'site'),

  -- contact group (all public)
  ('whatsapp_number',            NULL,           true,  'contact'),
  ('contact_email',              NULL,           true,  'contact'),
  ('contact_phone',              NULL,           true,  'contact'),
  ('footer_address',             NULL,           true,  'contact'),
  ('social_facebook',            NULL,           true,  'contact'),
  ('social_instagram',           NULL,           true,  'contact'),
  ('social_linkedin',            NULL,           true,  'contact'),
  ('social_youtube',             NULL,           true,  'contact'),

  -- business group (private, except bank_account_details)
  ('business_legal_name',        NULL,           false, 'business'),
  ('business_registration_no',   NULL,           false, 'business'),
  ('tax_registration_no',        NULL,           false, 'business'),
  ('business_address',           NULL,           false, 'business'),
  ('bank_account_details',       NULL,           true,  'business'),

  -- analytics group (all public)
  ('analytics_measurement_id',   NULL,           true,  'analytics'),

  -- ads group (all public)
  ('ads_enabled',                'false'::jsonb, true,  'ads'),
  ('adsense_client_id',          NULL,           true,  'ads'),
  ('adsense_slot_sidebar_left',  NULL,           true,  'ads'),
  ('adsense_slot_sidebar_right', NULL,           true,  'ads'),
  ('adsense_slot_in_article',    NULL,           true,  'ads'),
  ('banner_rotation_seconds',    '6'::jsonb,     true,  'ads'),

  -- system group (all private)
  ('idle_account_years',         '2'::jsonb,     false, 'system'),
  ('idle_warning_days',          '30'::jsonb,    false, 'system'),
  ('owner_alert_email',          NULL,           false, 'system')

ON CONFLICT (key) DO NOTHING;
