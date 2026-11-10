// Document types for the admin backend (S-069).
// Backend defines; frontend consumes. document_files.file_key never appears here.
// coverImageKey (the cover R2 key) is intentionally included — the admin screen needs it.

export type DocumentStatus = "draft" | "published" | "hidden";
export type DocKind = "checklist" | "safety_sign" | "toolbox_talk";
export type DocumentLanguage = "en" | "si" | "ta";
export type DocumentFileKind = "full" | "preview";
export type DocumentFileFormat = "pptx" | "png" | "jpg" | "pdf";
export type UploadFileStatus = "pending" | "ready" | "upload_failed";

/** Per-language-slot file status shown in the admin list and detail view. */
export type DocumentFileMark = "missing" | "uploading" | "ready";

/** One language slot as returned by listDocuments / getDocument. */
export interface DocumentLanguageSlot {
  language: DocumentLanguage;
  full: DocumentFileMark;
  /** Array of 3 preview slot statuses (index 0 = sort_order 1, …). */
  previews: [DocumentFileMark, DocumentFileMark, DocumentFileMark];
}

/** Result returned when a presigned upload is started. */
export interface UploadStart {
  fileId: string;
  uploadUrl: string;
}

/** Result of completeDocumentFileUpload. */
export type UploadStatus =
  | { ok: true; fileId: string; status: "ready" }
  | { ok: false; code: "not_allowed" }
  | { ok: false; code: "not_found" }
  | { ok: false; code: "validation_failed"; reason: "file_type" | "file_too_large" }
  | { ok: false; code: "upload_failed" }
  | { ok: false; code: "rate_limited" }
  | { ok: false; code: "unknown"; reason?: string };

export type StartUploadResult =
  | { ok: true; upload: UploadStart }
  | { ok: false; code: "not_allowed" }
  | { ok: false; code: "not_found" }
  | { ok: false; code: "validation_failed"; reason: "file_type" }
  | { ok: false; code: "rate_limited" }
  | { ok: false; code: "upload_failed" }
  | { ok: false; code: "unknown"; reason?: string };

export type SetDocumentStatusResult =
  | { ok: true; documentId: string; updatedAt: string; purgeWarning?: string }
  | { ok: false; code: "not_allowed" }
  | { ok: false; code: "not_found" }
  | { ok: false; code: "validation_failed"; reason: "files_missing"; missing: string[] }
  | { ok: false; code: "version_conflict" }
  | { ok: false; code: "unknown"; reason?: string };

/** Row returned by listDocuments (25 per page). No file keys. */
export interface AdminDocumentRow {
  id: string;
  title: string;
  slug: string;
  docKind: DocKind;
  categoryId: string;
  categoryName: string | null;
  priceCents: number;
  status: DocumentStatus;
  languageSlots: DocumentLanguageSlot[];
  updatedAt: string;
  createdAt: string;
}

/** Full document returned by getDocument. No file keys. */
export interface AdminDocument extends AdminDocumentRow {
  description: string | null;
  coverImageKey: string | null;
  pageCount: number | null;
  previewPages: number;
  downloadCount: number;
  purchaseCount: number;
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: string | null;
}

/** Input for saveDocument (create or edit). */
export interface SaveDocumentInput {
  /** Omit for create. */
  documentId?: string;
  title: string;
  description?: string | null;
  docKind: DocKind;
  categoryId: string;
  pageCount?: number | null;
  previewPages?: number;
  coverImageKey?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  /** Required on create; ignored on edit (price changes go through changeDocumentPrice). */
  priceLkr?: number;
  /** The updated_at the caller loaded. Required on edit for optimistic concurrency. */
  updatedAt?: string;
}

export type SaveDocumentResult =
  | { ok: true; documentId: string; slug: string; updatedAt: string }
  | { ok: false; code: "not_allowed" }
  | { ok: false; code: "not_found" }
  | { ok: false; code: "validation_failed"; reason: string }
  | { ok: false; code: "version_conflict" }
  | { ok: false; code: "rate_limited" }
  | { ok: false; code: "unknown"; reason?: string };

export type ChangeDocumentPriceResult =
  | { ok: true; documentId: string; newPriceCents: number; updatedAt: string }
  | { ok: false; code: "not_allowed" }
  | { ok: false; code: "not_found" }
  | { ok: false; code: "mfa_required" }
  | { ok: false; code: "validation_failed"; reason: string }
  | { ok: false; code: "version_conflict" }
  | { ok: false; code: "rate_limited" }
  | { ok: false; code: "unknown"; reason?: string };

export type ListDocumentsFilter = {
  status?: DocumentStatus;
  docKind?: DocKind;
  categoryId?: string;
  search?: string;
  page?: number;
};

export type ListDocumentsResult =
  | { ok: true; rows: AdminDocumentRow[]; total: number; page: number; pageSize: number }
  | { ok: false; code: "not_allowed" }
  | { ok: false; code: "validation_failed"; reason: string }
  | { ok: false; code: "unknown"; reason?: string };

export type GetDocumentResult =
  | { ok: true; document: AdminDocument }
  | { ok: false; code: "not_allowed" }
  | { ok: false; code: "not_found" }
  | { ok: false; code: "unknown"; reason?: string };
