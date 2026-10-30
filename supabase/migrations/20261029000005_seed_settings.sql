-- S-020 follow-up: move site_settings seed into a migration.
-- seed.sql is skipped by `supabase db push` (production deploys); a migration
-- is the only reliable path. ON CONFLICT (key) DO NOTHING keeps seed.sql
-- idempotent for local `supabase db reset` runs.
--
-- NOTE: bank_account_details is seeded as is_public=true per schema spec
-- (the schema marks it PUBLIC because buyers must see the account number).
-- Confirm with client before go-live whether anonymous API read of this
-- value is acceptable. See S-020 spec gap note.

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

  -- business group (private, except bank_account_details — see note above)
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
