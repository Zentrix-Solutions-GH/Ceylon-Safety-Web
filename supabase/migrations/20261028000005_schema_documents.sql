-- S-015: Schema 5 — documents and document_files
-- Owner decisions recorded in docs/stories/S-015-schema-documents.md:
--   • document_files gets updated_at (deliberate design extension)
--   • Cross-column format/kind CHECK enforced in DB
--   • Service role uses Supabase default RLS bypass (no explicit policy)

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. documents
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.documents (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              text        NOT NULL,
  title             text        NOT NULL,
  description       text,
  cover_image_key   text,
  category_id       uuid        REFERENCES public.categories(id) ON DELETE RESTRICT,
  file_format       text        NOT NULL DEFAULT 'pptx'
                                CONSTRAINT documents_file_format_check CHECK (file_format = 'pptx'),
  doc_kind          text        NOT NULL
                                CONSTRAINT documents_doc_kind_check CHECK (
                                  doc_kind IN ('checklist', 'safety_sign', 'toolbox_talk')
                                ),
  price_cents       integer     NOT NULL CONSTRAINT documents_price_cents_check CHECK (price_cents > 0),
  page_count        integer,
  preview_pages     integer     NOT NULL DEFAULT 3,
  download_count    integer     NOT NULL DEFAULT 0,
  purchase_count    integer     NOT NULL DEFAULT 0,
  status            text        NOT NULL DEFAULT 'draft'
                                CONSTRAINT documents_status_check CHECK (
                                  status IN ('draft', 'published', 'hidden')
                                ),
  published_at      timestamptz,
  seo_title         text,
  seo_description   text,
  search_vector     tsvector,
  deleted_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  -- Slug unique among live rows only
  CONSTRAINT documents_slug_unique UNIQUE NULLS NOT DISTINCT (slug, deleted_at)
);

-- published_at required when status = 'published'
ALTER TABLE public.documents
  ADD CONSTRAINT documents_published_at_required
    CHECK (status <> 'published' OR published_at IS NOT NULL);

COMMENT ON TABLE public.documents IS
  'One row per sellable document. English title and description only. File keys are in document_files.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. document_files  (ADMIN-ONLY — no public read policy)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.document_files (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id       uuid        NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  kind              text        NOT NULL CONSTRAINT document_files_kind_check CHECK (
                                  kind IN ('full', 'preview')
                                ),
  language          text        NOT NULL CONSTRAINT document_files_language_check CHECK (
                                  language IN ('en', 'si', 'ta')
                                ),
  format            text        NOT NULL CONSTRAINT document_files_format_check CHECK (
                                  format IN ('pptx', 'png', 'jpg', 'pdf')
                                ),
  file_key          text        NOT NULL UNIQUE,
  size_bytes        bigint      NOT NULL,
  checksum_sha256   text,
  version           integer     NOT NULL DEFAULT 1,
  is_current        boolean     NOT NULL DEFAULT true,
  status            text        NOT NULL DEFAULT 'pending'
                                CONSTRAINT document_files_status_check CHECK (
                                  status IN ('pending', 'ready')
                                ),
  uploaded_by       uuid        REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Cross-column: full files must be pptx; preview files must be image or pdf
ALTER TABLE public.document_files
  ADD CONSTRAINT document_files_format_kind_check CHECK (
    (kind = 'full'    AND format = 'pptx') OR
    (kind = 'preview' AND format IN ('png', 'jpg', 'pdf'))
  );

-- Only one current row per (document, kind, language)
CREATE UNIQUE INDEX document_files_current_unique
  ON public.document_files (document_id, kind, language)
  WHERE is_current;

COMMENT ON TABLE public.document_files IS
  'Admin-only. One row per language+kind per document. File keys for the private R2 bucket.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Indexes on documents
-- ─────────────────────────────────────────────────────────────────────────────

-- Partial: published and not deleted — used by public listing queries
CREATE INDEX documents_status_published_at_idx
  ON public.documents (status, published_at DESC)
  WHERE status = 'published' AND deleted_at IS NULL;

CREATE INDEX documents_category_id_idx
  ON public.documents (category_id);

CREATE INDEX documents_doc_kind_idx
  ON public.documents (doc_kind);

CREATE INDEX documents_download_count_idx
  ON public.documents (download_count DESC);

CREATE INDEX documents_purchase_count_idx
  ON public.documents (purchase_count DESC);

-- GIN on search_vector (for full-text search)
CREATE INDEX documents_search_vector_idx
  ON public.documents USING gin(search_vector);

-- Trigram on title (for partial-word / ILIKE search)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX documents_title_trgm_idx
  ON public.documents USING gin(title gin_trgm_ops);

-- Partial unique index for slug (live rows only); allows reuse after soft-delete
CREATE UNIQUE INDEX documents_slug_live_unique
  ON public.documents (slug)
  WHERE deleted_at IS NULL;

-- Drop the table-level constraint now that the partial index handles it
ALTER TABLE public.documents
  DROP CONSTRAINT documents_slug_unique;

-- Index on document_files.document_id
CREATE INDEX document_files_document_id_idx
  ON public.document_files (document_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Search-vector trigger for documents
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.documents_search_vector_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '')), 'B');
  RETURN NEW;
END;
$$;

CREATE TRIGGER documents_search_vector_trigger
  BEFORE INSERT OR UPDATE OF title, description
  ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.documents_search_vector_update();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. set_updated_at triggers
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TRIGGER documents_set_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER document_files_set_updated_at
  BEFORE UPDATE ON public.document_files
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.documents      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents      FORCE ROW LEVEL SECURITY;
ALTER TABLE public.document_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_files FORCE ROW LEVEL SECURITY;

-- documents: public (anon + authenticated) can read published, not deleted, not future
CREATE POLICY "documents_public_read"
  ON public.documents
  FOR SELECT
  TO anon, authenticated
  USING (
    status = 'published'
    AND published_at <= now()
    AND deleted_at IS NULL
  );

-- documents: staff with documents.* permission have full access
CREATE POLICY "documents_staff_all"
  ON public.documents
  FOR ALL
  TO authenticated
  USING (public.has_permission('documents.*'))
  WITH CHECK (public.has_permission('documents.*'));

-- document_files: NO policy for anon or regular customers — zero rows returned
-- Staff with documents.* permission have full access
CREATE POLICY "document_files_staff_all"
  ON public.document_files
  FOR ALL
  TO authenticated
  USING (public.has_permission('documents.*'))
  WITH CHECK (public.has_permission('documents.*'));

-- Service role bypasses RLS by Supabase default — no explicit policy needed.
