-- Add announcement banner settings keys to site_settings.
-- These drive the red bar above the navigation header.
-- All three are public (anon can read them); admin sets them in the CMS.
INSERT INTO public.site_settings (key, value, is_public, setting_group) VALUES
  ('announcement_enabled',  'false'::jsonb, true, 'site'),
  ('announcement_text',     '"Certified Industrial PPE & Fall Protection Equipment | Special Bulk Rates for Sri Lankan Sites"'::jsonb, true, 'site'),
  ('announcement_link_label', '"Shop Now"'::jsonb, true, 'site'),
  ('announcement_link_href',  '"/documents"'::jsonb, true, 'site')
ON CONFLICT (key) DO NOTHING;
