"use client";
import * as React from "react";
import { t, errorMessage } from "@/messages/en";
import { setDocumentStatus, countArticleRefs } from "@/lib/admin/actions";
import type { DocumentStatus } from "@/types/document";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LANGUAGE_LABEL_KEYS: Record<string, string> = {
  en: "admin.documents.upload.language.en",
  si: "admin.documents.upload.language.si",
  ta: "admin.documents.upload.language.ta",
};

function parseMissingList(missing: string[]): string[] {
  return missing.map((m) => {
    const [, lang] = m.split(":");
    if (!lang) return m;
    const key = LANGUAGE_LABEL_KEYS[lang];
    return key ? t(key as Parameters<typeof t>[0]) : lang;
  });
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  documentId: string;
  status: DocumentStatus;
  updatedAt: string;
  onStatusChange?: (status: DocumentStatus, updatedAt: string) => void;
}

// ---------------------------------------------------------------------------
// PublishPanel
// ---------------------------------------------------------------------------

export function PublishPanel({ documentId, status, updatedAt, onStatusChange }: Props) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [missingLangs, setMissingLangs] = React.useState<string[]>([]);
  const [purgeWarning, setPurgeWarning] = React.useState<string | null>(null);
  const [hideConfirmCount, setHideConfirmCount] = React.useState<number | null>(null);

  async function handlePublish() {
    setError(null);
    setMissingLangs([]);
    setPurgeWarning(null);
    setPending(true);

    const result = await setDocumentStatus(documentId, "publish", updatedAt);
    setPending(false);

    if (!result.ok) {
      if (result.code === "validation_failed" && (result as { reason?: string }).reason === "files_missing") {
        const r = result as { code: string; reason: string; missing: string[] };
        setError(errorMessage("validation_failed", "files_missing"));
        setMissingLangs(parseMissingList(r.missing ?? []));
      } else if (result.code === "validation_failed" && (result as { reason?: string }).reason === "already_done") {
        setError(errorMessage("validation_failed", "already_done"));
      } else {
        setError(errorMessage(result.code));
      }
      return;
    }

    if (result.purgeWarning) {
      setPurgeWarning(t("errors.purge_failed"));
    }
    onStatusChange?.("published", result.updatedAt);
  }

  async function handleHideClick() {
    setError(null);
    setPurgeWarning(null);
    setPending(true);

    const countResult = await countArticleRefs("document", documentId);
    if (!countResult.ok) {
      setPending(false);
      setError(errorMessage(countResult.code));
      return;
    }

    if (countResult.count > 0) {
      setHideConfirmCount(countResult.count);
      setPending(false);
      return;
    }

    await doHide();
  }

  async function doHide() {
    setPending(true);
    setHideConfirmCount(null);

    const result = await setDocumentStatus(documentId, "hide", updatedAt);
    setPending(false);

    if (!result.ok) {
      if (result.code === "version_conflict") {
        setError(errorMessage("version_conflict"));
      } else {
        setError(errorMessage(result.code));
      }
      return;
    }

    if (result.purgeWarning) {
      setPurgeWarning(t("errors.purge_failed"));
    }
    onStatusChange?.("hidden", result.updatedAt);
  }

  const isPublished = status === "published";

  return (
    <div className="space-y-3">
      {/* Action buttons */}
      <div className="flex gap-2">
        {!isPublished && (
          <button
            type="button"
            disabled={pending}
            onClick={handlePublish}
            className="inline-flex items-center rounded px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground disabled:opacity-50"
          >
            {pending ? t("admin.documents.publish.publishing") : t("admin.documents.publish.button")}
          </button>
        )}
        {isPublished && (
          <button
            type="button"
            disabled={pending}
            onClick={handleHideClick}
            className="inline-flex items-center rounded px-3 py-1.5 text-sm font-medium border disabled:opacity-50"
          >
            {pending ? t("admin.documents.hide.hiding") : t("admin.documents.hide.button")}
          </button>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div role="alert" className="space-y-1">
          <p className="text-sm text-destructive">{error}</p>
          {missingLangs.length > 0 && (
            <ul className="list-disc list-inside text-sm text-destructive">
              {missingLangs.map((lang) => (
                <li key={lang}>{lang}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Purge warning */}
      {purgeWarning && (
        <p role="status" className="text-sm text-amber-600">
          {purgeWarning}
        </p>
      )}

      {/* Hide confirmation dialog */}
      {hideConfirmCount !== null && (
        <div role="dialog" aria-modal="true" className="border rounded p-4 bg-background shadow space-y-3">
          <p className="text-sm">
            {t("admin.documents.hide.articles_warning").replace("{n}", String(hideConfirmCount))}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={doHide}
              disabled={pending}
              className="inline-flex items-center rounded px-3 py-1.5 text-sm font-medium bg-destructive text-destructive-foreground disabled:opacity-50"
            >
              {t("admin.documents.hide.confirm")}
            </button>
            <button
              type="button"
              onClick={() => setHideConfirmCount(null)}
              className="inline-flex items-center rounded px-3 py-1.5 text-sm font-medium border"
            >
              {t("admin.documents.hide.cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
