"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { t } from "@/messages/en";
import { saveDocumentSchema } from "@/lib/validation/document";
import { saveDocument } from "@/lib/admin/actions/documents";
import { useMediaUpload } from "@/hooks/useMediaUpload";
import { resizeImage } from "@/lib/content/image-resize";
import type { AdminDocument, DocKind, SaveDocumentInput } from "@/types/document";
import type { Category } from "@/types/article";
import type { AllowedImageMime } from "@/types/media";

interface Props {
  mode: "create" | "edit";
  document?: AdminDocument;
  categories: Category[];
}

type FieldErrors = Partial<Record<string, string>>;

const DOC_KIND_OPTIONS: { value: DocKind; label: string }[] = [
  { value: "checklist", label: t("admin.documents.filter_type_checklist") },
  { value: "safety_sign", label: t("admin.documents.filter_type_safety_sign") },
  { value: "toolbox_talk", label: t("admin.documents.filter_type_toolbox_talk") },
];

function mapServerError(code: string): string {
  if (code === "version_conflict") return t("admin.documents.form_error_version_conflict");
  if (code === "not_allowed") return t("admin.documents.form_error_not_allowed");
  if (code === "reauth_required") return t("admin.documents.form_error_reauth_required");
  if (code === "rate_limited") return t("admin.documents.form_error_rate_limited");
  return t("admin.documents.form_error_unknown");
}

export function DocumentForm({ mode, document: doc, categories }: Props) {
  const router = useRouter();

  const [title, setTitle] = useState(doc?.title ?? "");
  const [description, setDescription] = useState(doc?.description ?? "");
  const [docKind, setDocKind] = useState<DocKind | "">(doc?.docKind ?? "");
  const [categoryId, setCategoryId] = useState(doc?.categoryId ?? "");
  const [pageCount, setPageCount] = useState(
    doc?.pageCount != null ? String(doc.pageCount) : ""
  );
  const [previewPages, setPreviewPages] = useState(doc?.previewPages ?? 3);
  const [priceLkr, setPriceLkr] = useState("");
  const [coverImageKey, setCoverImageKey] = useState<string | null>(doc?.coverImageKey ?? null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);

  const coverFileRef = useRef<HTMLInputElement>(null);

  const { status: uploadStatus, upload: uploadMedia } = useMediaUpload({
    onSuccess: (mediaId) => {
      setCoverImageKey(mediaId);
    },
  });

  function validate(fields: Record<string, unknown>): FieldErrors | null {
    const result = saveDocumentSchema.safeParse(fields);
    if (!result.success) {
      const errs: FieldErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0]?.toString() ?? "_";
        if (!errs[key]) errs[key] = issue.message;
      }
      return errs;
    }
    return null;
  }

  function getFieldValues(): Record<string, unknown> {
    const values: Record<string, unknown> = {
      title,
      description: description || null,
      docKind: docKind || undefined,
      categoryId: categoryId || undefined,
      pageCount: pageCount ? parseInt(pageCount, 10) : null,
      previewPages,
      coverImageKey: coverImageKey ?? null,
    };
    if (mode === "create") {
      values.priceLkr = priceLkr ? Number(priceLkr) : undefined;
    } else if (doc) {
      values.documentId = doc.id;
      values.updatedAt = doc.updatedAt;
    }
    return values;
  }

  function handleBlur(field: string) {
    const values = getFieldValues();
    const result = saveDocumentSchema.safeParse(values);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0]?.toString() === field);
      if (issue) {
        setFieldErrors((prev) => ({ ...prev, [field]: issue.message }));
      }
    } else {
      setFieldErrors((prev) => {
        if (!prev[field]) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  function focusFirstError(errs: FieldErrors) {
    const firstKey = Object.keys(errs)[0];
    if (!firstKey) return;
    const el = document.getElementById(`doc-${firstKey}`) as HTMLElement | null;
    el?.focus();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (inFlight.current) return;

    setFormError(null);

    const values = getFieldValues();
    const errs = validate(values);
    if (errs) {
      setFieldErrors(errs);
      focusFirstError(errs);
      return;
    }
    setFieldErrors({});

    inFlight.current = true;
    setSaving(true);

    try {
      const input: SaveDocumentInput = {
        title,
        description: description || null,
        docKind: docKind as DocKind,
        categoryId,
        pageCount: pageCount ? parseInt(pageCount, 10) : null,
        previewPages,
        coverImageKey: coverImageKey ?? null,
        ...(mode === "create" ? { priceLkr: Number(priceLkr) } : {}),
        ...(mode === "edit" && doc
          ? { documentId: doc.id, updatedAt: doc.updatedAt }
          : {}),
      };
      const result = await saveDocument(input);
      if (result.ok) {
        router.push(`/admin/documents/${result.documentId}/edit`);
      } else {
        setFormError(mapServerError(result.code));
      }
    } catch {
      setFormError(t("admin.documents.form_error_unknown"));
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  async function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setCoverPreview(preview);
    const variants = await resizeImage(file);
    await uploadMedia(variants, file.type as AllowedImageMime);
  }

  const pageTitle =
    mode === "create"
      ? t("admin.documents.form_new_title")
      : t("admin.documents.form_edit_title");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{pageTitle}</h1>

      {/* Draft notice — always visible for new documents */}
      {(mode === "create" || doc?.status === "draft") && (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200">
          {t("admin.documents.draft_notice")}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-5 max-w-2xl">
        {/* Title */}
        <div>
          <label htmlFor="doc-title" className="block text-sm font-medium mb-1">
            {t("admin.documents.form_title_label")}
          </label>
          <input
            id="doc-title"
            name="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => handleBlur("title")}
            placeholder={t("admin.documents.form_title_placeholder")}
            aria-invalid={!!fieldErrors.title}
            aria-describedby={fieldErrors.title ? "doc-title-error" : undefined}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          {fieldErrors.title && (
            <p id="doc-title-error" className="mt-1 text-xs text-destructive">
              {fieldErrors.title}
            </p>
          )}
        </div>

        {/* Description */}
        <div>
          <label htmlFor="doc-description" className="block text-sm font-medium mb-1">
            {t("admin.documents.form_description_label")}
          </label>
          <textarea
            id="doc-description"
            name="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("admin.documents.form_description_placeholder")}
            rows={3}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>

        {/* Type */}
        <div>
          <label htmlFor="doc-docKind" className="block text-sm font-medium mb-1">
            {t("admin.documents.form_type_label")}
          </label>
          <select
            id="doc-docKind"
            name="docKind"
            value={docKind}
            onChange={(e) => setDocKind(e.target.value as DocKind | "")}
            onBlur={() => handleBlur("docKind")}
            aria-invalid={!!fieldErrors.docKind}
            aria-describedby={fieldErrors.docKind ? "doc-docKind-error" : undefined}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">{t("admin.documents.form_type_placeholder")}</option>
            {DOC_KIND_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {fieldErrors.docKind && (
            <p id="doc-docKind-error" className="mt-1 text-xs text-destructive">
              {fieldErrors.docKind}
            </p>
          )}
        </div>

        {/* Category */}
        <div>
          <label htmlFor="doc-categoryId" className="block text-sm font-medium mb-1">
            {t("admin.documents.form_category_label")}
          </label>
          <select
            id="doc-categoryId"
            name="categoryId"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            onBlur={() => handleBlur("categoryId")}
            aria-invalid={!!fieldErrors.categoryId}
            aria-describedby={fieldErrors.categoryId ? "doc-categoryId-error" : undefined}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">{t("admin.documents.form_category_placeholder")}</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
          {fieldErrors.categoryId && (
            <p id="doc-categoryId-error" className="mt-1 text-xs text-destructive">
              {fieldErrors.categoryId}
            </p>
          )}
        </div>

        {/* Page count */}
        <div>
          <label htmlFor="doc-pageCount" className="block text-sm font-medium mb-1">
            {t("admin.documents.form_page_count_label")}
          </label>
          <input
            id="doc-pageCount"
            name="pageCount"
            type="number"
            min={1}
            value={pageCount}
            onChange={(e) => setPageCount(e.target.value)}
            placeholder={t("admin.documents.form_page_count_placeholder")}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>

        {/* Preview pages */}
        <div>
          <label htmlFor="doc-previewPages" className="block text-sm font-medium mb-1">
            {t("admin.documents.form_preview_pages_label")}
          </label>
          <input
            id="doc-previewPages"
            name="previewPages"
            type="number"
            min={1}
            max={20}
            value={previewPages}
            onChange={(e) => setPreviewPages(Number(e.target.value))}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>

        {/* Cover image */}
        <div>
          <label htmlFor="doc-cover" className="block text-sm font-medium mb-1">
            {t("admin.documents.form_cover_label")}
          </label>
          {(coverPreview || coverImageKey) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverPreview ?? ""}
              alt="Cover preview"
              className="mb-2 h-32 w-auto rounded-md object-cover"
            />
          )}
          <input
            id="doc-cover"
            ref={coverFileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleCoverChange}
            className="block text-sm"
          />
          {uploadStatus === "upload_failed" && (
            <p className="mt-1 text-xs text-destructive">
              {t("admin.documents.form_error_upload_failed")}
            </p>
          )}
          {uploadStatus === "uploading" && (
            <p className="mt-1 text-xs text-muted-foreground">Uploading…</p>
          )}
        </div>

        {/* Price — create only; read-only on edit */}
        {mode === "create" ? (
          <div>
            <label htmlFor="doc-priceLkr" className="block text-sm font-medium mb-1">
              {t("admin.documents.form_price_label")}
            </label>
            <input
              id="doc-priceLkr"
              name="priceLkr"
              type="number"
              min={1}
              step={1}
              value={priceLkr}
              onChange={(e) => setPriceLkr(e.target.value)}
              onBlur={() => handleBlur("priceLkr")}
              placeholder={t("admin.documents.form_price_placeholder")}
              aria-invalid={!!fieldErrors.priceLkr}
              aria-describedby={fieldErrors.priceLkr ? "doc-priceLkr-error" : undefined}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            {fieldErrors.priceLkr && (
              <p id="doc-priceLkr-error" className="mt-1 text-xs text-destructive">
                {fieldErrors.priceLkr}
              </p>
            )}
          </div>
        ) : (
          <div>
            <p className="text-sm font-medium mb-1">{t("admin.documents.form_price_label")}</p>
            <p className="text-sm tabular-nums">
              {doc
                ? `LKR ${(doc.priceCents / 100).toLocaleString("en-LK", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`
                : "—"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("admin.documents.form_price_readonly_note")}
            </p>
          </div>
        )}

        {/* Form-level error */}
        {formError && (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {saving
              ? t("admin.documents.form_saving")
              : t("admin.documents.form_save_button")}
          </button>
          <a
            href="/admin/documents"
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            {t("admin.documents.form_cancel")}
          </a>
        </div>
      </form>
    </div>
  );
}
