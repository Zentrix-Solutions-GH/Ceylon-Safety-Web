import "server-only";
import { createHash } from "crypto";
import { requireStaff } from "@/lib/auth/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { writeAuditRow, writeDenied } from "@/lib/audit/index";
import { checkAdminWriteLimit } from "@/lib/ratelimit/index";
import { r2Config, PPTX_MAX_BYTES, PREVIEW_MAX_BYTES } from "@/lib/config";
import {
  presignedPut,
  headObject,
  getObjectBytes,
  deleteObject,
} from "@/lib/r2/storage";
import type {
  DocumentLanguage,
  DocumentFileKind,
  StartUploadResult,
  UploadStatus,
} from "@/types/document";

// ---------------------------------------------------------------------------
// Magic-byte signatures for real-type verification (AC3, EC2).
// ---------------------------------------------------------------------------

function matchesMagic(bytes: Uint8Array, magic: number[]): boolean {
  if (bytes.length < magic.length) return false;
  return magic.every((b, i) => bytes[i] === b);
}

const MAGIC: Record<string, number[]> = {
  pptx: [0x50, 0x4b, 0x03, 0x04], // ZIP (OOXML)
  pdf:  [0x25, 0x50, 0x44, 0x46],  // %PDF
  png:  [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  jpg:  [0xff, 0xd8],
};

function isValidFormat(bytes: Uint8Array, format: string): boolean {
  const magic = MAGIC[format];
  return magic ? matchesMagic(bytes, magic) : false;
}

// ---------------------------------------------------------------------------
// Key paths (AC1)
// ---------------------------------------------------------------------------

function fullKey(documentId: string, language: string, version: number, ext: string): string {
  const name = `${Date.now()}.${ext}`;
  return `documents/${documentId}/${language}/v${version}/${name}`;
}

function previewKey(documentId: string, language: string, sortOrder: number, ext: string): string {
  const name = `${Date.now()}.${ext}`;
  return `previews/${documentId}/${language}/${sortOrder}/${name}`;
}

// ---------------------------------------------------------------------------
// Validation (AC2)
// ---------------------------------------------------------------------------

const VALID_LANGUAGES: DocumentLanguage[] = ["en", "si", "ta"];
const VALID_KINDS: DocumentFileKind[] = ["full", "preview"];
const FULL_FORMAT = "pptx";
const PREVIEW_FORMATS = ["png", "jpg", "pdf"];

interface StartUploadInput {
  documentId: string;
  kind: DocumentFileKind;
  language: DocumentLanguage;
  sortOrder: number;
  format: string; // "pptx" for full; "png"|"jpg"|"pdf" for preview
  sizeBytes: number;
}

// ---------------------------------------------------------------------------
// startDocumentFileUpload (AC1, AC2, AC10)
// ---------------------------------------------------------------------------

export async function startDocumentFileUpload(
  input: StartUploadInput,
): Promise<StartUploadResult> {
  // Permission re-check on every call (security rules)
  const auth = await requireStaff("documents.*");
  if (!auth.ok) {
    await writeDenied("unknown", "document_files", "upload_start").catch(() => {});
    return { ok: false, code: "not_allowed" };
  }

  // Rate limit (AC10)
  const rl = await checkAdminWriteLimit(auth.user.id);
  if (!rl.ok) return { ok: false, code: "rate_limited" };

  // Input validation (AC2)
  if (!VALID_LANGUAGES.includes(input.language)) {
    return { ok: false, code: "validation_failed", reason: "file_type" };
  }
  if (!VALID_KINDS.includes(input.kind)) {
    return { ok: false, code: "validation_failed", reason: "file_type" };
  }
  if (input.kind === "full" && input.sortOrder !== 1) {
    return { ok: false, code: "validation_failed", reason: "file_type" };
  }
  if (input.kind === "preview" && (input.sortOrder < 1 || input.sortOrder > 3)) {
    return { ok: false, code: "validation_failed", reason: "file_type" };
  }
  if (input.kind === "full" && input.format !== FULL_FORMAT) {
    return { ok: false, code: "validation_failed", reason: "file_type" };
  }
  if (input.kind === "preview" && !PREVIEW_FORMATS.includes(input.format)) {
    return { ok: false, code: "validation_failed", reason: "file_type" };
  }

  const cfg = r2Config();
  if (!cfg) return { ok: false, code: "unknown", reason: "r2_not_configured" };

  const supabase = createSupabaseServiceRoleClient();

  // Verify document exists and is not soft-deleted (AC1)
  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .select("id")
    .eq("id", input.documentId)
    .is("deleted_at", null)
    .single();

  if (docErr || !doc) return { ok: false, code: "not_found" };

  // Determine next version for this slot
  const { data: existing } = await supabase
    .from("document_files")
    .select("version")
    .eq("document_id", input.documentId)
    .eq("kind", input.kind)
    .eq("language", input.language)
    .eq("sort_order", input.sortOrder)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = existing ? (existing.version as number) + 1 : 1;

  // Build key using validated format as extension
  const key =
    input.kind === "full"
      ? fullKey(input.documentId, input.language, nextVersion, input.format)
      : previewKey(input.documentId, input.language, input.sortOrder, input.format);
  // Note: file name uses generated name regardless of browser file name (AC1)

  // Create pending row
  const { data: row, error: insertErr } = await supabase
    .from("document_files")
    .insert({
      document_id: input.documentId,
      kind: input.kind,
      language: input.language,
      sort_order: input.sortOrder,
      format: input.format,
      file_key: key,
      size_bytes: input.sizeBytes,
      version: nextVersion,
      is_current: false,
      status: "pending",
      uploaded_by: auth.user.id,
    })
    .select("id")
    .single();

  if (insertErr || !row) {
    return { ok: false, code: "unknown", reason: insertErr?.message };
  }

  // Generate presigned PUT URL (single-part; size verified post-upload)
  const MIME: Record<string, string> = {
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    pdf:  "application/pdf",
    png:  "image/png",
    jpg:  "image/jpeg",
  };
  const mimeType = MIME[input.format] ?? "application/octet-stream";
  let uploadUrl: string;
  try {
    uploadUrl = await presignedPut(cfg.bucketPrivate, key, mimeType);
  } catch {
    // R2 unavailable — delete the pending row so it doesn't litter the DB
    await supabase.from("document_files").delete().eq("id", row.id);
    return { ok: false, code: "upload_failed" };
  }

  // Audit (AC8)
  await writeAuditRow({
    action: "document.file_upload",
    actorId: auth.user.id,
    entityType: "document_files",
    entityId: row.id,
    after: { documentId: input.documentId, kind: input.kind, language: input.language, sortOrder: input.sortOrder, status: "pending" },
  });

  return { ok: true, upload: { fileId: row.id, uploadUrl } };
}

// ---------------------------------------------------------------------------
// completeDocumentFileUpload (AC3, AC4, EC3, EC4, EC9, EC10, EC11)
// ---------------------------------------------------------------------------

export async function completeDocumentFileUpload(fileId: string): Promise<UploadStatus> {
  // Re-check permission (EC9)
  const auth = await requireStaff("documents.*");
  if (!auth.ok) {
    await writeDenied("unknown", "document_files", "complete").catch(() => {});
    return { ok: false, code: "not_allowed" };
  }

  const cfg = r2Config();
  if (!cfg) return { ok: false, code: "unknown", reason: "r2_not_configured" };

  const supabase = createSupabaseServiceRoleClient();

  // Fetch the pending row
  const { data: row, error: rowErr } = await supabase
    .from("document_files")
    .select("id, document_id, kind, language, sort_order, format, file_key, status, is_current, version")
    .eq("id", fileId)
    .single();

  if (rowErr || !row) return { ok: false, code: "not_found" };

  // EC11: already ready
  if (row.status === "ready") return { ok: false, code: "upload_failed" };

  // EC10: check the object exists in R2
  const meta = await headObject(cfg.bucketPrivate, row.file_key);
  if (!meta) {
    await markFailed(supabase, fileId);
    return { ok: false, code: "upload_failed" };
  }

  // EC8: size check — zero bytes OR over limit
  const maxBytes = row.kind === "full" ? PPTX_MAX_BYTES : PREVIEW_MAX_BYTES;
  if (meta.contentLength <= 0) {
    await deleteObject(cfg.bucketPrivate, row.file_key);
    await markFailed(supabase, fileId);
    return { ok: false, code: "validation_failed", reason: "file_type" };
  }
  if (meta.contentLength > maxBytes) {
    await deleteObject(cfg.bucketPrivate, row.file_key);
    await markFailed(supabase, fileId);
    return { ok: false, code: "validation_failed", reason: "file_too_large" };
  }

  // AC3: real-type check via magic bytes
  const magicBytes = await getObjectBytes(cfg.bucketPrivate, row.file_key, 8);
  if (!magicBytes || !isValidFormat(magicBytes, row.format)) {
    await deleteObject(cfg.bucketPrivate, row.file_key);
    await markFailed(supabase, fileId);
    return { ok: false, code: "validation_failed", reason: "file_type" };
  }

  // Compute checksum before entering the atomic DB step (AC3)
  const fullBytes = await getObjectBytes(cfg.bucketPrivate, row.file_key, meta.contentLength);
  if (!fullBytes) {
    // R2 read failed after magic-byte check passed — treat as upload failure
    await markFailed(supabase, fileId);
    return { ok: false, code: "upload_failed" };
  }
  const checksum = createHash("sha256").update(fullBytes).digest("hex");

  // AC4: flip old current row + mark new row ready in one Postgres transaction
  // via complete_document_file RPC (migration 20261110000003).
  const { error: rpcErr } = await supabase.rpc("complete_document_file", {
    p_file_id:          fileId,
    p_size_bytes:       meta.contentLength,
    p_checksum_sha256:  checksum,
  });

  if (rpcErr) return { ok: false, code: "unknown", reason: rpcErr.message };

  // Audit (AC8)
  await writeAuditRow({
    action: "document.file_upload",
    actorId: auth.user.id,
    entityType: "document_files",
    entityId: fileId,
    after: { documentId: row.document_id, kind: row.kind, language: row.language, sortOrder: row.sort_order, status: "ready" },
  });

  return { ok: true, fileId, status: "ready" };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function markFailed(supabase: { from: (t: string) => any }, fileId: string): Promise<void> {
  await supabase
    .from("document_files")
    .update({ status: "upload_failed" })
    .eq("id", fileId);
}
