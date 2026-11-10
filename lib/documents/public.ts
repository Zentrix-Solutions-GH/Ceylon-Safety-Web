import "server-only";
import { unstable_cache } from "next/cache";
import { createSupabaseAnonClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/server";
import { serverConfig } from "@/lib/config";
import {
  publicDocumentsQuerySchema,
  listDocumentPickerSchema,
} from "@/lib/validation/document";
import {
  DOCUMENTS_LIST_TAG,
  DOCUMENTS_NOT_FOUND_TAG,
} from "@/lib/cache/tags";
import type {
  PublicDocumentCard,
  PublicDocument,
  DocumentPickerItem,
  DocumentLanguage,
  PreviewAvailability,
  ListPublicDocumentsResult,
  GetPublicDocumentResult,
  ListDocumentPickerItemsResult,
  DocumentFilters,
} from "@/types/document";

// Cache window constants — exported for unit tests (AC7).
export const LIST_CACHE_SECONDS = 60;
export const DOCUMENT_CACHE_SECONDS = 300;
export const NOT_FOUND_CACHE_SECONDS = 60;

// ---------------------------------------------------------------------------
// Internal row types
// ---------------------------------------------------------------------------

type FileRow = {
  kind: string;
  language: string;
  sort_order: number;
  status: string;
  is_current: boolean;
};

type PublicDocRow = {
  id: string;
  slug: string;
  title: string;
  cover_image_key: string | null;
  price_cents: number;
  page_count: number | null;
  download_count: number;
  doc_kind: string;
  category_id: string;
  categories: { name: string | null } | null;
  document_files?: FileRow[];
  description?: string | null;
};

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

const LANGUAGES: DocumentLanguage[] = ["en", "si", "ta"];

function readyFullLanguages(files: FileRow[]): DocumentLanguage[] {
  return LANGUAGES.filter(lang =>
    files.some(f => f.kind === "full" && f.language === lang && f.is_current && f.status === "ready")
  );
}

function previewAvailability(files: FileRow[]): PreviewAvailability {
  const result = {} as PreviewAvailability;
  for (const lang of LANGUAGES) {
    result[lang] = files.filter(
      f => f.kind === "preview" && f.language === lang && f.is_current && f.status === "ready"
        && f.sort_order >= 1 && f.sort_order <= 3
    ).length;
  }
  return result;
}

function mapCard(row: PublicDocRow): PublicDocumentCard {
  const files = row.document_files ?? [];
  const languages = readyFullLanguages(files);
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    coverImageKey: row.cover_image_key,
    priceCents: row.price_cents,
    pageCount: row.page_count,
    downloadCount: row.download_count,
    docKind: row.doc_kind as PublicDocumentCard["docKind"],
    categoryId: row.category_id,
    categoryName: row.categories?.name ?? null,
    languages,
    unavailable: languages.length === 0,
  };
}

// ---------------------------------------------------------------------------
// Column selects — never include file_key (AC2, REQ-055)
// ---------------------------------------------------------------------------

const LIST_COLUMNS = `
  id, slug, title, cover_image_key, price_cents, page_count, download_count, doc_kind,
  category_id,
  categories(name),
  document_files(kind, language, sort_order, status, is_current)
`;

const DETAIL_COLUMNS = `
  id, slug, title, cover_image_key, price_cents, page_count, download_count, doc_kind,
  category_id, description,
  categories(name),
  document_files(kind, language, sort_order, status, is_current)
`;

// ---------------------------------------------------------------------------
// listPublicDocuments — GET /api/documents (AC1, EC4, EC6)
// ---------------------------------------------------------------------------

async function queryPublicDocuments(
  category: string | undefined,
  type: string | undefined,
  sort: "newest" | "popular",
  page: number
): Promise<ListPublicDocumentsResult> {
  const pageSize = serverConfig.documentsPageSize;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabase = createSupabaseAnonClient();
  const now = new Date().toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase
    .from("documents")
    .select(LIST_COLUMNS, { count: "exact" })
    .eq("status", "published")
    .lte("published_at", now)
    .is("deleted_at", null)
    .range(from, to);

  if (category) query = query.eq("category_id", category);
  if (type) query = query.eq("doc_kind", type);

  if (sort === "popular") {
    query = query.order("download_count", { ascending: false }).order("published_at", { ascending: false });
  } else {
    query = query.order("published_at", { ascending: false });
  }

  const { data, error, count } = await query;
  if (error) return { ok: false, code: "unknown", reason: (error as Error).message };

  const rows = (data ?? []) as PublicDocRow[];

  return {
    ok: true,
    data: {
      documents: rows.map(mapCard),
      total: count ?? 0,
      page,
      pageSize,
    },
  };
}

export async function listPublicDocuments(
  rawFilters: DocumentFilters
): Promise<ListPublicDocumentsResult> {
  const parsed = publicDocumentsQuerySchema.safeParse(rawFilters);
  if (!parsed.success) {
    const reason = parsed.error.issues?.[0]?.message ?? "invalid filter";
    return { ok: false, code: "validation_failed", reason };
  }

  const { category, type, sort, page } = parsed.data;
  const cacheKey = `docs-list:${category ?? ""}:${type ?? ""}:${sort}:${page}`;

  const cached = unstable_cache(
    () => queryPublicDocuments(category, type, sort, page),
    [cacheKey],
    { revalidate: LIST_CACHE_SECONDS, tags: [DOCUMENTS_LIST_TAG] }
  );

  return cached();
}

// ---------------------------------------------------------------------------
// getPublicDocument — by slug, used server-side by the page (AC3, EC1, EC5)
// ---------------------------------------------------------------------------

async function queryPublicDocument(slug: string): Promise<GetPublicDocumentResult> {
  const supabase = createSupabaseAnonClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("documents")
    .select(DETAIL_COLUMNS)
    .eq("slug", slug)
    .eq("status", "published")
    .lte("published_at", now)
    .is("deleted_at", null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .maybeSingle() as any;

  if (error) return { ok: false, code: "unknown", reason: (error as Error).message };

  if (!data) {
    // Check slug_redirects (EC5)
    const { data: redirect } = await supabase
      .from("slug_redirects")
      .select("entity_id")
      .eq("entity_type", "document")
      .eq("old_slug", slug)
      .maybeSingle();

    if (redirect?.entity_id) {
      // Fetch the current slug for that document id
      const { data: current } = await supabase
        .from("documents")
        .select("slug")
        .eq("id", redirect.entity_id)
        .eq("status", "published")
        .is("deleted_at", null)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .maybeSingle() as any;

      if (current?.slug) {
        return { ok: false, code: "redirect", newSlug: current.slug };
      }
    }

    return { ok: false, code: "not_found" };
  }

  const row = data as PublicDocRow;
  const files = row.document_files ?? [];
  const card = mapCard(row);

  const doc: PublicDocument = {
    ...card,
    description: row.description ?? null,
    previewAvailability: previewAvailability(files),
  };

  return { ok: true, document: doc };
}

// getPublicDocument — AC7: found responses cached 300s / DOCUMENTS_LIST_TAG;
// not_found and redirect responses cached 60s / DOCUMENTS_NOT_FOUND_TAG.
// Lookup order: found cache first (300s); only on ok:false fall through to the
// not-found cache (60s). This avoids a double DB round-trip on cold found lookups.
export async function getPublicDocument(slug: string): Promise<GetPublicDocumentResult> {
  const foundCached = unstable_cache(
    () => queryPublicDocument(slug),
    [`doc-slug:${slug}`],
    { revalidate: DOCUMENT_CACHE_SECONDS, tags: [DOCUMENTS_LIST_TAG] }
  );

  const notFoundCached = unstable_cache(
    () => queryPublicDocument(slug),
    [`doc-slug-nf:${slug}`],
    { revalidate: NOT_FOUND_CACHE_SECONDS, tags: [DOCUMENTS_NOT_FOUND_TAG] }
  );

  const foundResult = await foundCached();
  if (foundResult.ok) return foundResult;
  // Slug is missing/hidden — cache under the short-lived not-found tag (AC7).
  return notFoundCached();
}

// ---------------------------------------------------------------------------
// servePreviewFile — used by GET /api/preview/[documentId] (AC5, EC2, EC3)
// Returns the file_key for a ready current preview row; never returns a full file.
// The route is responsible for fetching from R2 and streaming.
// ---------------------------------------------------------------------------

export type ServePreviewResult =
  | { ok: true; fileKey: string; format: string }
  | { ok: false; code: "not_found" }
  | { ok: false; code: "unknown"; reason?: string };

export async function servePreviewFile(
  documentId: string,
  language: DocumentLanguage,
  page: number
): Promise<ServePreviewResult> {
  // Validate using service role so RLS cannot interfere with document_files
  // (document_files has NO public read policy; this route gate is the server).
  const supabase = createSupabaseServiceRoleClient();
  const now = new Date().toISOString();

  // Verify the document is visible (published, not deleted). RLS covers documents
  // for anonClient but we recheck manually here since we're using service role.
  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .select("id")
    .eq("id", documentId)
    .eq("status", "published")
    .lte("published_at", now)
    .is("deleted_at", null)
    .maybeSingle();

  if (docErr) return { ok: false, code: "unknown", reason: docErr.message };
  if (!doc) return { ok: false, code: "not_found" };

  // Fetch the preview file — explicitly filter kind = preview (EC2 guard).
  const { data: fileRow, error: fileErr } = await supabase
    .from("document_files")
    .select("file_key, format")
    .eq("document_id", documentId)
    .eq("kind", "preview")  // NEVER 'full' — AC5 invariant
    .eq("language", language)
    .eq("sort_order", page)
    .eq("is_current", true)
    .eq("status", "ready")
    .maybeSingle();

  if (fileErr) return { ok: false, code: "unknown", reason: fileErr.message };
  if (!fileRow) return { ok: false, code: "not_found" };

  return { ok: true, fileKey: fileRow.file_key as string, format: fileRow.format as string };
}

// ---------------------------------------------------------------------------
// listDocumentPickerItems — AC6
// ---------------------------------------------------------------------------

const PICKER_PAGE_SIZE = 20;

export async function listDocumentPickerItems(
  input: { search?: string; page?: number }
): Promise<ListDocumentPickerItemsResult> {
  const auth = await requireStaff("articles.*");
  if (!auth.ok) return { ok: false, code: "not_allowed" };

  const parsed = listDocumentPickerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "unknown" };

  const { search, page } = parsed.data;
  const from = (page - 1) * PICKER_PAGE_SIZE;
  const to = from + PICKER_PAGE_SIZE;

  const supabase = createSupabaseAnonClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase
    .from("documents")
    .select("id, slug, title, cover_image_key, price_cents")
    .eq("status", "published")
    .is("deleted_at", null)
    .range(from, to);

  if (search?.trim()) {
    query = query.ilike("title", `%${search.trim()}%`);
  }

  const { data, error } = await query;
  if (error) return { ok: false, code: "unknown", reason: (error as Error).message };

  type PickerRow = { id: string; slug: string; title: string; cover_image_key: string | null; price_cents: number };
  const rows = (data ?? []) as PickerRow[];
  const hasMore = rows.length > PICKER_PAGE_SIZE;

  const items: DocumentPickerItem[] = rows.slice(0, PICKER_PAGE_SIZE).map(r => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    coverImageKey: r.cover_image_key,
    priceCents: r.price_cents,
    kind: "document" as const,
  }));

  return { ok: true, items, hasMore };
}
