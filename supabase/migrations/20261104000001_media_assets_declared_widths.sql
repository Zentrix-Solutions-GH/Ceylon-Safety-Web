-- S-047: Store the variant widths that were declared at upload time so that
-- confirmImageUpload can check exactly the declared variants rather than a
-- hardcoded list. Existing rows get the standard [480, 1200] default.
ALTER TABLE public.media_assets
  ADD COLUMN IF NOT EXISTS declared_widths INTEGER[]
    NOT NULL DEFAULT '{480,1200}';
