-- S-015: pgTAP tests for documents and document_files
-- Run with: supabase test db
-- Requires Docker + local Supabase stack.

BEGIN;
SELECT plan(80);

-- ─────────────────────────────────────────────────────────────────────────────
-- Helpers
-- ─────────────────────────────────────────────────────────────────────────────

-- Insert a test category (categories must exist for FK)
INSERT INTO public.categories (id, name, slug, applies_to)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Test Category',
  'test-category',
  'documents'
) ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- AC1: documents table columns and constraints
-- ─────────────────────────────────────────────────────────────────────────────

SELECT has_table('public', 'documents', 'AC1: documents table exists');

SELECT has_column('public', 'documents', 'id',              'AC1: documents.id');
SELECT has_column('public', 'documents', 'slug',            'AC1: documents.slug');
SELECT has_column('public', 'documents', 'title',           'AC1: documents.title');
SELECT has_column('public', 'documents', 'description',     'AC1: documents.description');
SELECT has_column('public', 'documents', 'cover_image_key', 'AC1: documents.cover_image_key');
SELECT has_column('public', 'documents', 'category_id',     'AC1: documents.category_id');
SELECT has_column('public', 'documents', 'file_format',     'AC1: documents.file_format');
SELECT has_column('public', 'documents', 'doc_kind',        'AC1: documents.doc_kind');
SELECT has_column('public', 'documents', 'price_cents',     'AC1: documents.price_cents');
SELECT has_column('public', 'documents', 'page_count',      'AC1: documents.page_count');
SELECT has_column('public', 'documents', 'preview_pages',   'AC1: documents.preview_pages');
SELECT has_column('public', 'documents', 'download_count',  'AC1: documents.download_count');
SELECT has_column('public', 'documents', 'purchase_count',  'AC1: documents.purchase_count');
SELECT has_column('public', 'documents', 'status',          'AC1: documents.status');
SELECT has_column('public', 'documents', 'published_at',    'AC1: documents.published_at');
SELECT has_column('public', 'documents', 'seo_title',       'AC1: documents.seo_title');
SELECT has_column('public', 'documents', 'seo_description', 'AC1: documents.seo_description');
SELECT has_column('public', 'documents', 'search_vector',   'AC1: documents.search_vector');
SELECT has_column('public', 'documents', 'deleted_at',      'AC1: documents.deleted_at');
SELECT has_column('public', 'documents', 'created_at',      'AC1: documents.created_at');
SELECT has_column('public', 'documents', 'updated_at',      'AC1: documents.updated_at');

-- No locale / translation_group_id / file key columns
SELECT hasnt_column('public', 'documents', 'locale',                'AC1: no locale column');
SELECT hasnt_column('public', 'documents', 'translation_group_id',  'AC1: no translation_group_id');
SELECT hasnt_column('public', 'documents', 'file_key',              'AC1: no file_key column');

-- EC1: price_cents > 0 enforced
SELECT throws_ok(
  $$INSERT INTO public.documents (slug, title, category_id, file_format, doc_kind, price_cents, status)
    VALUES ('bad-price', 'Bad', '00000000-0000-0000-0000-000000000001', 'pptx', 'checklist', 0, 'draft')$$,
  'EC1: price_cents = 0 is refused'
);

SELECT throws_ok(
  $$INSERT INTO public.documents (slug, title, category_id, file_format, doc_kind, price_cents, status)
    VALUES ('neg-price', 'Neg', '00000000-0000-0000-0000-000000000001', 'pptx', 'checklist', -100, 'draft')$$,
  'EC1: negative price_cents is refused'
);

-- EC2: invalid file_format / doc_kind refused
SELECT throws_ok(
  $$INSERT INTO public.documents (slug, title, category_id, file_format, doc_kind, price_cents, status)
    VALUES ('bad-format', 'Bad', '00000000-0000-0000-0000-000000000001', 'pdf', 'checklist', 100, 'draft')$$,
  'EC2: file_format = pdf is refused'
);

SELECT throws_ok(
  $$INSERT INTO public.documents (slug, title, category_id, file_format, doc_kind, price_cents, status)
    VALUES ('bad-kind', 'Bad', '00000000-0000-0000-0000-000000000001', 'pptx', 'poster', 100, 'draft')$$,
  'EC2: doc_kind = poster is refused'
);

-- EC5: slug unique among live rows; reuse after soft-delete allowed
DO $$
DECLARE
  doc_id1 uuid;
  doc_id2 uuid;
BEGIN
  INSERT INTO public.documents (slug, title, category_id, file_format, doc_kind, price_cents, status)
  VALUES ('reuse-slug', 'First', '00000000-0000-0000-0000-000000000001', 'pptx', 'checklist', 100, 'draft')
  RETURNING id INTO doc_id1;

  -- Duplicate slug among live rows: refused
  BEGIN
    INSERT INTO public.documents (slug, title, category_id, file_format, doc_kind, price_cents, status)
    VALUES ('reuse-slug', 'Second', '00000000-0000-0000-0000-000000000001', 'pptx', 'checklist', 200, 'draft');
    RAISE EXCEPTION 'EC5: duplicate live slug should have been refused';
  EXCEPTION WHEN unique_violation THEN
    NULL; -- expected
  END;

  -- Soft-delete the first row, then reuse slug: allowed
  UPDATE public.documents SET deleted_at = now() WHERE id = doc_id1;

  INSERT INTO public.documents (id, slug, title, category_id, file_format, doc_kind, price_cents, status)
  VALUES ('00000000-0000-0000-0000-000000000010', 'reuse-slug', 'Reused', '00000000-0000-0000-0000-000000000001', 'pptx', 'checklist', 200, 'draft')
  RETURNING id INTO doc_id2;
END;
$$;
SELECT pass('EC5: slug reuse after soft-delete is allowed, duplicate live slug refused');

-- EC7: published without published_at refused
SELECT throws_ok(
  $$INSERT INTO public.documents (slug, title, category_id, file_format, doc_kind, price_cents, status, published_at)
    VALUES ('pub-no-date', 'Pub', '00000000-0000-0000-0000-000000000001', 'pptx', 'checklist', 100, 'published', NULL)$$,
  'EC7: published without published_at is refused'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- AC2: document_files columns and constraints
-- ─────────────────────────────────────────────────────────────────────────────

SELECT has_table('public', 'document_files', 'AC2: document_files table exists');

SELECT has_column('public', 'document_files', 'id',             'AC2: document_files.id');
SELECT has_column('public', 'document_files', 'document_id',    'AC2: document_files.document_id');
SELECT has_column('public', 'document_files', 'kind',           'AC2: document_files.kind');
SELECT has_column('public', 'document_files', 'language',       'AC2: document_files.language');
SELECT has_column('public', 'document_files', 'format',         'AC2: document_files.format');
SELECT has_column('public', 'document_files', 'file_key',       'AC2: document_files.file_key');
SELECT has_column('public', 'document_files', 'size_bytes',     'AC2: document_files.size_bytes');
SELECT has_column('public', 'document_files', 'checksum_sha256','AC2: document_files.checksum_sha256');
SELECT has_column('public', 'document_files', 'version',        'AC2: document_files.version');
SELECT has_column('public', 'document_files', 'is_current',     'AC2: document_files.is_current');
SELECT has_column('public', 'document_files', 'status',         'AC2: document_files.status');
SELECT has_column('public', 'document_files', 'uploaded_by',    'AC2: document_files.uploaded_by');
SELECT has_column('public', 'document_files', 'created_at',     'AC2: document_files.created_at');
SELECT has_column('public', 'document_files', 'updated_at',     'AC2: document_files.updated_at');

-- EC3 / EC9: unique (document_id, kind, language) where is_current
DO $$
DECLARE
  doc_id uuid := '00000000-0000-0000-0000-000000000010';
BEGIN
  INSERT INTO public.document_files (document_id, kind, language, format, file_key, size_bytes)
  VALUES (doc_id, 'full', 'en', 'pptx', 'private/docs/v1/en.pptx', 1024);

  -- Second current full/en: refused
  BEGIN
    INSERT INTO public.document_files (document_id, kind, language, format, file_key, size_bytes)
    VALUES (doc_id, 'full', 'en', 'pptx', 'private/docs/v2/en.pptx', 2048);
    RAISE EXCEPTION 'EC3: second current full/en should be refused';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  -- Non-current older version: allowed
  INSERT INTO public.document_files (document_id, kind, language, format, file_key, size_bytes, is_current)
  VALUES (doc_id, 'full', 'en', 'pptx', 'private/docs/v0/en.pptx', 512, false);

  -- Second current preview/en: refused (EC9)
  INSERT INTO public.document_files (document_id, kind, language, format, file_key, size_bytes)
  VALUES (doc_id, 'preview', 'en', 'png', 'private/previews/en-1.png', 200);

  BEGIN
    INSERT INTO public.document_files (document_id, kind, language, format, file_key, size_bytes)
    VALUES (doc_id, 'preview', 'en', 'png', 'private/previews/en-2.png', 200);
    RAISE EXCEPTION 'EC9: second current preview/en should be refused';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;
END;
$$;
SELECT pass('EC3/EC9: unique current (document_id, kind, language) enforced; non-current allowed');

-- EC4: duplicate file_key refused
SELECT throws_ok(
  $$INSERT INTO public.document_files (document_id, kind, language, format, file_key, size_bytes)
    VALUES ('00000000-0000-0000-0000-000000000010', 'full', 'si', 'pptx', 'private/docs/v1/en.pptx', 999)$$,
  'EC4: duplicate file_key is refused'
);

-- EC8: format/kind mismatch refused
SELECT throws_ok(
  $$INSERT INTO public.document_files (document_id, kind, language, format, file_key, size_bytes)
    VALUES ('00000000-0000-0000-0000-000000000010', 'full', 'ta', 'png', 'private/docs/bad.png', 100)$$,
  'EC8: full file with format=png is refused'
);

SELECT throws_ok(
  $$INSERT INTO public.document_files (document_id, kind, language, format, file_key, size_bytes)
    VALUES ('00000000-0000-0000-0000-000000000010', 'preview', 'ta', 'pptx', 'private/previews/bad.pptx', 100)$$,
  'EC8: preview file with format=pptx is refused'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- AC3 / AC4: indexes and triggers
-- ─────────────────────────────────────────────────────────────────────────────

SELECT has_index('public', 'documents', 'documents_status_published_at_idx',
  'AC3: partial index on (status, published_at DESC) exists');

SELECT has_index('public', 'documents', 'documents_category_id_idx',
  'AC3: index on category_id exists');

SELECT has_index('public', 'documents', 'documents_doc_kind_idx',
  'AC3: index on doc_kind exists');

SELECT has_index('public', 'documents', 'documents_download_count_idx',
  'AC3: index on download_count exists');

SELECT has_index('public', 'documents', 'documents_purchase_count_idx',
  'AC3: index on purchase_count exists');

SELECT has_index('public', 'documents', 'documents_search_vector_idx',
  'AC3: GIN index on search_vector exists');

SELECT has_index('public', 'documents', 'documents_title_trgm_idx',
  'AC3: trigram index on title exists');

SELECT has_index('public', 'document_files', 'document_files_document_id_idx',
  'AC3: index on document_files.document_id exists');

SELECT has_trigger('public', 'documents', 'documents_set_updated_at',
  'AC4: documents set_updated_at trigger exists');

SELECT has_trigger('public', 'document_files', 'document_files_set_updated_at',
  'AC4: document_files set_updated_at trigger exists');

SELECT has_trigger('public', 'documents', 'documents_search_vector_trigger',
  'AC3: search_vector trigger exists');

-- Search vector is populated on insert
DO $$
DECLARE
  doc_id uuid;
  sv tsvector;
BEGIN
  INSERT INTO public.documents (slug, title, description, category_id, file_format, doc_kind, price_cents, status)
  VALUES ('sv-test', 'Fire Safety Checklist', 'A guide to fire prevention', '00000000-0000-0000-0000-000000000001', 'pptx', 'checklist', 500, 'draft')
  RETURNING id INTO doc_id;

  SELECT search_vector INTO sv FROM public.documents WHERE id = doc_id;
  ASSERT sv IS NOT NULL AND sv <> ''::tsvector,
    'AC3: search_vector must be populated on insert';
END;
$$;
SELECT pass('AC3: search_vector populated on insert');

-- ─────────────────────────────────────────────────────────────────────────────
-- AC5 / AC6: RLS
-- ─────────────────────────────────────────────────────────────────────────────

-- Insert a published and a hidden document for RLS tests
DO $$
BEGIN
  INSERT INTO public.documents (id, slug, title, category_id, file_format, doc_kind, price_cents, status, published_at)
  VALUES ('00000000-0000-0000-0000-000000000020', 'pub-doc', 'Published Doc',
          '00000000-0000-0000-0000-000000000001', 'pptx', 'checklist', 1000, 'published', now() - interval '1 hour');

  INSERT INTO public.documents (id, slug, title, category_id, file_format, doc_kind, price_cents, status)
  VALUES ('00000000-0000-0000-0000-000000000021', 'hidden-doc', 'Hidden Doc',
          '00000000-0000-0000-0000-000000000001', 'pptx', 'checklist', 1000, 'hidden');

  INSERT INTO public.documents (id, slug, title, category_id, file_format, doc_kind, price_cents, status)
  VALUES ('00000000-0000-0000-0000-000000000022', 'draft-doc', 'Draft Doc',
          '00000000-0000-0000-0000-000000000001', 'pptx', 'checklist', 1000, 'draft');

  INSERT INTO public.documents (id, slug, title, category_id, file_format, doc_kind, price_cents, status, published_at, deleted_at)
  VALUES ('00000000-0000-0000-0000-000000000023', 'deleted-doc', 'Deleted Doc',
          '00000000-0000-0000-0000-000000000001', 'pptx', 'checklist', 1000, 'published', now() - interval '1 hour', now());

  INSERT INTO public.documents (id, slug, title, category_id, file_format, doc_kind, price_cents, status, published_at)
  VALUES ('00000000-0000-0000-0000-000000000024', 'future-doc', 'Future Doc',
          '00000000-0000-0000-0000-000000000001', 'pptx', 'checklist', 1000, 'published', now() + interval '1 day');

  -- Add a file row for the published document
  INSERT INTO public.document_files (id, document_id, kind, language, format, file_key, size_bytes)
  VALUES ('00000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-000000000020',
          'full', 'en', 'pptx', 'private/pub-doc/en.pptx', 5000);
END;
$$;

-- AC6: anon selects from document_files → zero rows
SET LOCAL role TO anon;

SELECT is(
  (SELECT count(*)::int FROM public.document_files),
  0,
  'AC6: anon gets zero rows from document_files'
);

-- AC6: anon sees published doc but not hidden/draft/deleted/future
SELECT is(
  (SELECT count(*)::int FROM public.documents WHERE id = '00000000-0000-0000-0000-000000000020'::uuid),
  1,
  'AC6: anon can see published document'
);

SELECT is(
  (SELECT count(*)::int FROM public.documents WHERE id IN (
    '00000000-0000-0000-0000-000000000021'::uuid,
    '00000000-0000-0000-0000-000000000022'::uuid,
    '00000000-0000-0000-0000-000000000023'::uuid,
    '00000000-0000-0000-0000-000000000024'::uuid
  )),
  0,
  'AC6: anon cannot see hidden/draft/deleted/future documents'
);

-- AC6: anon cannot update price_cents/download_count/status
SELECT throws_ok(
  $$UPDATE public.documents SET price_cents = 1 WHERE id = '00000000-0000-0000-0000-000000000020'$$,
  'AC6: anon cannot update price_cents'
);

RESET role;

-- AC6: authenticated customer (no documents.* permission) gets zero rows from document_files
-- and cannot update documents

DO $$
DECLARE
  customer_id uuid := gen_random_uuid();
BEGIN
  -- Create a test customer profile (no role_permissions rows → no documents.* permission)
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (customer_id, 'testcustomer@example.com', 'Test Customer')
  ON CONFLICT DO NOTHING;
END;
$$;

SET LOCAL role TO authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"00000000-0000-0000-0000-000000000099","role":"authenticated"}';

SELECT is(
  (SELECT count(*)::int FROM public.document_files),
  0,
  'AC6: authenticated customer gets zero rows from document_files'
);

SELECT is(
  (SELECT count(*)::int FROM public.documents WHERE id IN (
    '00000000-0000-0000-0000-000000000021'::uuid,
    '00000000-0000-0000-0000-000000000022'::uuid,
    '00000000-0000-0000-0000-000000000023'::uuid,
    '00000000-0000-0000-0000-000000000024'::uuid
  )),
  0,
  'AC6: authenticated customer cannot see hidden/draft/deleted/future documents'
);

SELECT throws_ok(
  $$UPDATE public.documents SET price_cents = 1 WHERE id = '00000000-0000-0000-0000-000000000020'$$,
  'AC6: authenticated customer cannot update price_cents'
);

SELECT throws_ok(
  $$UPDATE public.documents SET download_count = 999 WHERE id = '00000000-0000-0000-0000-000000000020'$$,
  'AC6: authenticated customer cannot update download_count'
);

SELECT throws_ok(
  $$UPDATE public.documents SET status = 'hidden' WHERE id = '00000000-0000-0000-0000-000000000020'$$,
  'AC6: authenticated customer cannot update status'
);

RESET role;
RESET "request.jwt.claims";

-- EC6: hiding/deleting a document leaves document_files rows untouched
DO $$
DECLARE
  file_count int;
BEGIN
  UPDATE public.documents SET status = 'hidden' WHERE id = '00000000-0000-0000-0000-000000000020';
  UPDATE public.documents SET deleted_at = now() WHERE id = '00000000-0000-0000-0000-000000000020';

  SELECT count(*)::int INTO file_count FROM public.document_files
  WHERE document_id = '00000000-0000-0000-0000-000000000020';

  ASSERT file_count = 1, 'EC6: file rows must remain when document is hidden/deleted';
END;
$$;
SELECT pass('EC6: document_files rows survive document hide/delete');

SELECT * FROM finish();
ROLLBACK;
