-- S-048 fix: article_refs.ref_id must be text, not uuid.
-- Media refs store the file key (e.g. "img/cover.webp"), not a UUID.
-- video/document/course refs store UUIDs as text; Postgres accepts UUID strings
-- in a text column without casting, so existing FK-less refs are unaffected.

-- 1. Add a temporary text column.
ALTER TABLE public.article_refs ADD COLUMN ref_id_text text;
-- 2. Copy existing UUID values as text.
UPDATE public.article_refs SET ref_id_text = ref_id::text;
-- 3. Drop the uuid column (CASCADE removes dependent indexes).
ALTER TABLE public.article_refs DROP COLUMN ref_id;
-- 4. Rename the text column.
ALTER TABLE public.article_refs RENAME COLUMN ref_id_text TO ref_id;
ALTER TABLE public.article_refs ALTER COLUMN ref_id SET NOT NULL;

-- Restore indexes (dropped by CASCADE on the old column).
CREATE UNIQUE INDEX idx_article_refs_unique
  ON public.article_refs (article_id, node_id, ref_type, ref_id, COALESCE(phrase, ''));

CREATE INDEX idx_article_refs_ref ON public.article_refs (ref_type, ref_id);
