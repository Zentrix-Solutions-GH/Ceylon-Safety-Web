// Document types — admin (S-069) and public (S-071).
// Backend defines; frontend consumes. document_files.file_key never appears in any response.
// coverImageKey on AdminDocument is the cover R2 key — admin screen needs it; public types never expose it.

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

// ── Public types (S-071) ────────────────────────────────────────────────────

/** Languages that have a current ready full file. AC2. */
export type PublicDocumentLanguages = DocumentLanguage[];

/**
 * Per-language preview availability: count of ready current preview rows (sort_order 1–3).
 * 0 = no preview for this language. AC3 (analyst gap resolved).
 */
export type PreviewAvailability = Record<DocumentLanguage, number>;

/** Card shown in the public document list. No file keys, no file sizes. AC2. */
export interface PublicDocumentCard {
  id: string;
  slug: string;
  title: string;
  coverImageKey: string | null;
  priceCents: number;
  pageCount: number | null;
  downloadCount: number;
  docKind: DocKind;
  categoryId: string;
  categoryName: string | null;
  languages: PublicDocumentLanguages;
  /** True when no ready full file exists in any language (post-publish file removal). AC4. */
  unavailable: boolean;
}

/** Full document as returned by getPublicDocument(slug). AC3. */
export interface PublicDocument extends PublicDocumentCard {
  description: string | null;
  previewAvailability: PreviewAvailability;
}

/** Filters accepted by GET /api/documents. AC1. */
export interface DocumentFilters {
  category?: string;
  type?: DocKind;
  sort?: "newest" | "popular";
  page?: number;
}

/** Response envelope from GET /api/documents. AC1. */
export interface DocumentsPage {
  documents: PublicDocumentCard[];
  total: number;
  page: number;
  pageSize: number;
}

export type ListPublicDocumentsResult =
  | { ok: true; data: DocumentsPage }
  | { ok: false; code: "validation_failed"; reason: string }
  | { ok: false; code: "unknown"; reason?: string };

export type GetPublicDocumentResult =
  | { ok: true; document: PublicDocument }
  | { ok: false; code: "not_found" }
  /** slug was found in slug_redirects — caller should 301 to newSlug. */
  | { ok: false; code: "redirect"; newSlug: string }
  | { ok: false; code: "unknown"; reason?: string };

/** Item returned by listDocumentPickerItems. AC6. */
export interface DocumentPickerItem {
  id: string;
  slug: string;
  title: string;
  coverImageKey: string | null;
  priceCents: number;
  kind: "document";
}

export type ListDocumentPickerItemsResult =
  | { ok: true; items: DocumentPickerItem[]; hasMore: boolean }
  | { ok: false; code: "not_allowed" }
  | { ok: false; code: "unknown"; reason?: string };
