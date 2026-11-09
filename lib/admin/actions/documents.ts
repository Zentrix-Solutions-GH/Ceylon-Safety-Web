import "server-only";
import { requireStaff } from "@/lib/auth/server";
import { requireStepUp } from "@/lib/auth/step-up";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { writeAuditRow } from "@/lib/audit/index";
import { checkAdminWriteLimit } from "@/lib/ratelimit/index";
import { generateSlug, RESERVED_SLUGS } from "@/lib/content/slug";
import { z } from "zod";
import { saveDocumentSchema, changeDocumentPriceSchema } from "@/lib/validation/document";
import type {
  AdminDocumentRow,
  AdminDocument,
  DocumentFileMark,
  DocumentLanguageSlot,
  DocumentLanguage,
  DocKind,
  DocumentStatus,
  SaveDocumentInput,
  SaveDocumentResult,
  ChangeDocumentPriceResult,
  ListDocumentsFilter,
  ListDocumentsResult,
  GetDocumentResult,
} from "@/types/document";
import type { AuditEventName } from "@/types/audit";

// ---------------------------------------------------------------------------
// Daily drop limit — max 2 drops of > 50% per actor per UTC calendar day.
// Production: Upstash via Redis key; dev/test: in-memory Map.
// ---------------------------------------------------------------------------

const MAX_DAILY_DROPS = 2;
// Map key: "actorId:YYYY-MM-DD"
const _dailyDrops = new Map<string, number>();

function todayKey(actorId: string): string {
  return `${actorId}:${new Date().toISOString().slice(0, 10)}`;
}

async function checkDailyDropLimit(actorId: string): Promise<boolean> {
  const key = todayKey(actorId);
  return (_dailyDrops.get(key) ?? 0) < MAX_DAILY_DROPS;
}

async function incrementDailyDropCount(actorId: string): Promise<void> {
  const key = todayKey(actorId);
  _dailyDrops.set(key, (_dailyDrops.get(key) ?? 0) + 1);
}

/** @internal Reset per-actor daily drop counter between tests. Never call in production. */
export function _resetDailyDropCountForTest(actorId: string): void {
  const key = todayKey(actorId);
  _dailyDrops.delete(key);
}

// ---------------------------------------------------------------------------
// Slug helpers for documents (no locale; unique slug where deleted_at IS NULL)
// ---------------------------------------------------------------------------

async function clashSafeDocumentSlug(
  baseSlug: string,
  documentId: string | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: { from: (table: string) => any }
): Promise<string> {
  let candidate = baseSlug;
  let attempt = 0;

  while (true) {
    const result = await supabase
      .from("documents")
      .select("id")
      .eq("slug", candidate)
      .is("deleted_at", null);

    const rows = (result.data ?? []) as { id: string }[];
    const clash = rows.some((r: { id: string }) => r.id !== documentId);
    if (!clash) return candidate;

    attempt++;
    candidate = `${baseSlug}-${attempt}`;
  }
}

// ---------------------------------------------------------------------------
// Row mappers — never expose file_key (AC12)
// ---------------------------------------------------------------------------

type FileRow = {
  kind: string;
  language: string;
  status: string;
  is_current: boolean;
};

type DocQueryRow = {
  id: string;
  title: string;
  slug: string;
  doc_kind: string;
  category_id: string;
  categories: { name: string | null } | null;
  price_cents: number;
  status: string;
  updated_at: string;
  created_at: string;
  document_files?: FileRow[];
  description?: string | null;
  cover_image_key?: string | null;
  page_count?: number | null;
  preview_pages?: number;
  download_count?: number;
  purchase_count?: number;
  seo_title?: string | null;
  seo_description?: string | null;
  published_at?: string | null;
};

function buildLanguageSlots(files: FileRow[]): DocumentLanguageSlot[] {
  const languages: DocumentLanguage[] = ["en", "si", "ta"];
  return languages.map((lang) => {
    const currentFiles = files.filter((f) => f.language === lang && f.is_current);
    const fullFile = currentFiles.find((f) => f.kind === "full");
    const previewFile = currentFiles.find((f) => f.kind === "preview");

    const toMark = (f: FileRow | undefined): DocumentFileMark => {
      if (!f) return "missing";
      return f.status === "ready" ? "ready" : "uploading";
    };

    return { language: lang, full: toMark(fullFile), preview: toMark(previewFile) };
  });
}

export function mapDocumentRow(row: DocQueryRow): AdminDocumentRow {
  const files = (row.document_files ?? []) as FileRow[];
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    docKind: row.doc_kind as DocKind,
    categoryId: row.category_id,
    categoryName: row.categories?.name ?? null,
    priceCents: row.price_cents,
    status: row.status as DocumentStatus,
    languageSlots: buildLanguageSlots(files),
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  };
}

export function mapDocumentDetail(row: DocQueryRow): AdminDocument {
  return {
    ...mapDocumentRow(row),
    description: row.description ?? null,
    coverImageKey: row.cover_image_key ?? null,
    pageCount: row.page_count ?? null,
    previewPages: row.preview_pages ?? 3,
    downloadCount: row.download_count ?? 0,
    purchaseCount: row.purchase_count ?? 0,
    seoTitle: row.seo_title ?? null,
    seoDescription: row.seo_description ?? null,
    publishedAt: row.published_at ?? null,
  };
}

// ---------------------------------------------------------------------------
// Column selects — never include file_key
// ---------------------------------------------------------------------------

const LIST_COLUMNS = `
  id, title, slug, doc_kind, category_id, price_cents, status, updated_at, created_at,
  categories!inner(name),
  document_files(kind, language, status, is_current)
`;

const DETAIL_COLUMNS = `
  id, title, slug, doc_kind, category_id, price_cents, status, updated_at, created_at,
  description, cover_image_key, page_count, preview_pages, download_count, purchase_count,
  seo_title, seo_description, published_at,
  categories!inner(name),
  document_files(kind, language, status, is_current)
`;

const PAGE_SIZE = 25;

// ---------------------------------------------------------------------------
// listDocuments (AC1)
// ---------------------------------------------------------------------------

export async function listDocuments(
  filter: ListDocumentsFilter = {}
): Promise<ListDocumentsResult> {
  const auth = await requireStaff("documents.*");
  if (!auth.ok) return { ok: false, code: "not_allowed" };

  const supabase = createSupabaseServiceRoleClient();
  const page = Math.max(1, filter.page ?? 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("documents")
    .select(LIST_COLUMNS, { count: "exact" })
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .range(from, to);

  if (filter.status) query = query.eq("status", filter.status);
  if (filter.docKind) query = query.eq("doc_kind", filter.docKind);
  if (filter.categoryId) query = query.eq("category_id", filter.categoryId);
  if (filter.search) query = query.textSearch("title", filter.search, { type: "plain" });

  const { data, error, count } = await query;
  if (error) return { ok: false, code: "unknown", reason: error.message };

  const rows = (data ?? []) as DocQueryRow[];
  return {
    ok: true,
    rows: rows.map(mapDocumentRow),
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
  };
}

// ---------------------------------------------------------------------------
// getDocument (AC2)
// ---------------------------------------------------------------------------

export async function getDocument(id: string): Promise<GetDocumentResult> {
  const auth = await requireStaff("documents.*");
  if (!auth.ok) return { ok: false, code: "not_allowed" };

  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, code: "not_found" };
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("documents")
    .select(DETAIL_COLUMNS)
    .eq("id", id)
    .is("deleted_at", null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .single() as any;

  if (error || !data) return { ok: false, code: "not_found" };

  return { ok: true, document: mapDocumentDetail(data as DocQueryRow) };
}

// ---------------------------------------------------------------------------
// saveDocument (AC3–AC6, AC10, AC11)
// ---------------------------------------------------------------------------

export async function saveDocument(input: SaveDocumentInput): Promise<SaveDocumentResult> {
  // ── Auth ─────────────────────────────────────────────────────────────────
  const auth = await requireStaff("documents.*");
  if (!auth.ok) return { ok: false, code: "not_allowed" };
  const actorId = auth.user.id;

  // ── Rate limit (AC11) ────────────────────────────────────────────────────
  const rl = await checkAdminWriteLimit(actorId);
  if (!rl.ok) return { ok: false, code: "rate_limited" };

  // ── Validation (AC3, EC1–EC3) ────────────────────────────────────────────
  const parsed = saveDocumentSchema.safeParse(input);
  if (!parsed.success) {
    const reason = parsed.error.issues?.[0]?.message ?? "invalid input";
    return { ok: false, code: "validation_failed", reason };
  }
  const data = parsed.data;

  const supabase = createSupabaseServiceRoleClient();
  const isCreate = !data.documentId;

  // ── Price required on create (AC4) ──────────────────────────────────────
  if (isCreate && !data.priceLkr) {
    return { ok: false, code: "validation_failed", reason: "price is required on create" };
  }

  // ── Fetch existing row (edit) ────────────────────────────────────────────
  type ExistingRow = { id: string; slug: string; status: string; updated_at: string; price_cents: number };
  let existing: ExistingRow | null = null;
  if (data.documentId) {
    const { data: row, error } = await supabase
      .from("documents")
      .select("id, slug, status, updated_at, price_cents")
      .eq("id", data.documentId)
      .is("deleted_at", null)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .single() as any;

    if (error || !row) return { ok: false, code: "not_found" };
    existing = row as ExistingRow;
  }

  // ── Optimistic concurrency (AC6, EC5) ────────────────────────────────────
  // On edit, updatedAt is required — omitting it would allow a silent blind overwrite.
  if (existing && !data.updatedAt) {
    return { ok: false, code: "validation_failed", reason: "updatedAt is required on edit" };
  }
  if (existing && data.updatedAt && existing.updated_at !== data.updatedAt) {
    return { ok: false, code: "version_conflict" };
  }

  // ── Category existence check ─────────────────────────────────────────────
  const { data: catRow, error: catErr } = await supabase
    .from("categories")
    .select("id")
    .eq("id", data.categoryId)
    .is("deleted_at", null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .single() as any;

  if (catErr || !catRow) {
    return { ok: false, code: "validation_failed", reason: "category not found" };
  }

  // ── Slug (AC5, EC4) ──────────────────────────────────────────────────────
  let slug: string;
  if (existing?.slug) {
    // On edit, keep the existing slug — never regenerate from the title.
    slug = existing.slug;
  } else {
    slug = generateSlug(data.title);
    // Reserved-slug guard only on create (never on edit — existing slug is already safe).
    if (RESERVED_SLUGS.has(slug)) {
      slug = `doc-${slug}`;
    }
  }

  slug = await clashSafeDocumentSlug(slug, existing?.id ?? null, supabase);

  // ── Build shared fields (never include price_cents on edit — AC4) ────────
  const sharedFields: Record<string, unknown> = {
    title: data.title,
    description: data.description ?? null,
    doc_kind: data.docKind,
    category_id: data.categoryId,
    page_count: data.pageCount ?? null,
    preview_pages: data.previewPages ?? 3,
    cover_image_key: data.coverImageKey ?? null,
    seo_title: data.seoTitle ?? null,
    seo_description: data.seoDescription ?? null,
    slug,
  };

  let savedId: string;
  let savedSlug: string;
  let savedUpdatedAt: string;

  if (existing) {
    // ── Edit ────────────────────────────────────────────────────────────────
    const { data: updated, error: updateErr } = await supabase
      .from("documents")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(sharedFields as any)
      .eq("id", existing.id)
      .eq("updated_at", existing.updated_at) // DB-level concurrency guard
      .select("id, slug, updated_at")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .single() as any;

    if (updateErr || !updated) {
      // Zero rows matched (concurrent update changed updated_at)
      if (!updated || (updateErr as { code?: string } | null)?.code === "PGRST116") {
        return { ok: false, code: "version_conflict" };
      }
      return { ok: false, code: "unknown", reason: (updateErr as Error).message };
    }

    const u = updated as { id: string; slug: string; updated_at: string };
    savedId = u.id;
    savedSlug = u.slug;
    savedUpdatedAt = u.updated_at;

    // ── Slug redirect + audit for published documents (AC5, AC10) ──────────
    if (existing.status === "published" && existing.slug && existing.slug !== savedSlug) {
      await writeSlugRedirect(supabase, savedId, existing.slug, savedSlug);
      await writeAuditRow({
        action: "document.slug_change" as AuditEventName,
        actorId: auth.user.id,
        entityType: "document",
        entityId: savedId,
        before: { slug: existing.slug },
        after: { slug: savedSlug },
      });
    }
  } else {
    // ── Create ──────────────────────────────────────────────────────────────
    const insertFields = {
      ...sharedFields,
      status: "draft" as const,
      file_format: "pptx" as const,
      price_cents: (data.priceLkr as number) * 100,
    };

    const { data: inserted, error: insertErr } = await supabase
      .from("documents")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert(insertFields as any)
      .select("id, slug, updated_at")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .single() as any;

    if (insertErr || !inserted) {
      return { ok: false, code: "unknown", reason: (insertErr as Error | null)?.message };
    }

    const i = inserted as { id: string; slug: string; updated_at: string };
    savedId = i.id;
    savedSlug = i.slug;
    savedUpdatedAt = i.updated_at;
  }

  // ── Audit row (AC10) ─────────────────────────────────────────────────────
  await writeAuditRow({
    action: "document.save" as AuditEventName,
    actorId,
    entityType: "document",
    entityId: savedId,
    after: {
      slug: savedSlug,
      action: isCreate ? "create" : "edit",
    },
  });

  return { ok: true, documentId: savedId, slug: savedSlug, updatedAt: savedUpdatedAt };
}

// ── Slug redirect helper ───────────────────────────────────────────────────
async function writeSlugRedirect(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: { from: (table: string) => any },
  documentId: string,
  oldSlug: string,
  newSlug: string
): Promise<void> {
  // Flatten: update all existing redirects for this document to point at the new slug
  await supabase
    .from("slug_redirects")
    .update({ new_slug: newSlug })
    .eq("entity_type", "document")
    .eq("entity_id", documentId);

  // Insert the new redirect row for the old slug
  await supabase.from("slug_redirects").insert({
    entity_type: "document",
    entity_id: documentId,
    old_slug: oldSlug,
    new_slug: newSlug,
  });
}

// ---------------------------------------------------------------------------
// changeDocumentPrice (AC7–AC10, EC7–EC9)
// ---------------------------------------------------------------------------

export async function changeDocumentPrice(input: {
  documentId: string;
  newPriceLkr: number;
  confirmedLargeChange?: boolean;
  authenticatorCode?: string;
}): Promise<ChangeDocumentPriceResult> {
  // ── Auth ─────────────────────────────────────────────────────────────────
  const auth = await requireStaff("documents.price");
  if (!auth.ok) return { ok: false, code: "not_allowed" };
  const actorId = auth.user.id;

  // ── Rate limit ───────────────────────────────────────────────────────────
  const rl = await checkAdminWriteLimit(actorId);
  if (!rl.ok) return { ok: false, code: "rate_limited" };

  // ── Input validation ──────────────────────────────────────────────────────
  const parsed = changeDocumentPriceSchema.safeParse(input);
  if (!parsed.success) {
    const reason = parsed.error.issues?.[0]?.message ?? "invalid input";
    return { ok: false, code: "validation_failed", reason };
  }
  const data = parsed.data;

  // ── Step-up (AC7, EC8) ────────────────────────────────────────────────────
  try {
    await requireStepUp(actorId, data.authenticatorCode);
  } catch (err) {
    if ((err as { code?: string })?.code === "mfa_required") {
      return { ok: false, code: "mfa_required" };
    }
    throw err;
  }

  // ── Fetch document ────────────────────────────────────────────────────────
  const supabase = createSupabaseServiceRoleClient();
  const { data: docRow, error: docErr } = await supabase
    .from("documents")
    .select("id, price_cents, status, updated_at")
    .eq("id", data.documentId)
    .is("deleted_at", null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .single() as any;

  if (docErr || !docRow) return { ok: false, code: "not_found" };

  const doc = docRow as { id: string; price_cents: number; status: string; updated_at: string };
  const oldPriceCents = doc.price_cents;
  const newPriceCents = data.newPriceLkr * 100;

  // ── Large-change guard (AC8, EC7) ─────────────────────────────────────────
  const changeFraction = Math.abs(newPriceCents - oldPriceCents) / oldPriceCents;
  const isLargeChange = changeFraction > 0.5; // strictly > 50%
  if (isLargeChange && !data.confirmedLargeChange) {
    return { ok: false, code: "validation_failed", reason: "confirm_large_change" };
  }

  // ── Daily drop limit (EC9) ────────────────────────────────────────────────
  const isDrop = newPriceCents < oldPriceCents;
  if (isDrop && isLargeChange) {
    const withinLimit = await checkDailyDropLimit(actorId);
    if (!withinLimit) {
      return { ok: false, code: "rate_limited" };
    }
  }

  // ── Update price ──────────────────────────────────────────────────────────
  const { data: updated, error: updateErr } = await supabase
    .from("documents")
    .update({ price_cents: newPriceCents })
    .eq("id", doc.id)
    .eq("updated_at", doc.updated_at)
    .select("id, price_cents, updated_at")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .single() as any;

  if (updateErr || !updated) {
    if (!updated || (updateErr as { code?: string } | null)?.code === "PGRST116") {
      return { ok: false, code: "version_conflict" };
    }
    return { ok: false, code: "unknown", reason: (updateErr as Error).message };
  }

  const u = updated as { id: string; price_cents: number; updated_at: string };

  // ── Increment daily drop counter after a successful large drop ────────────
  if (isDrop && isLargeChange) {
    await incrementDailyDropCount(actorId);
  }

  // ── Audit row (AC10) ──────────────────────────────────────────────────────
  await writeAuditRow({
    action: "price.change" as AuditEventName,
    actorId,
    entityType: "document",
    entityId: doc.id,
    before: { price_cents: oldPriceCents },
    after: { price_cents: newPriceCents },
  });

  return { ok: true, documentId: doc.id, newPriceCents: u.price_cents, updatedAt: u.updated_at };
}
