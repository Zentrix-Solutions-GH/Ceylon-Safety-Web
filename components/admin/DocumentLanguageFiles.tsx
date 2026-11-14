"use client";
import * as React from "react";
import { t, errorMessage } from "@/messages/en";
import { startDocumentFileUpload, completeDocumentFileUpload } from "@/lib/admin/actions";
import type { DocumentLanguageSlot, DocumentLanguage } from "@/types/document";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SlotKind = "full" | "preview";

interface UploadSlotState {
  status: "idle" | "uploading" | "failed";
  error?: string;
  progress: number;
  /** fileId returned by startDocumentFileUpload, used for XHR cancel */
  abortController?: AbortController;
}

interface Props {
  documentId: string;
  slots: DocumentLanguageSlot[];
  onSlotsChange: (slots: DocumentLanguageSlot[]) => void;
}

const LANGUAGES: { code: DocumentLanguage; labelKey: string }[] = [
  { code: "en", labelKey: "admin.documents.upload.language.en" },
  { code: "si", labelKey: "admin.documents.upload.language.si" },
  { code: "ta", labelKey: "admin.documents.upload.language.ta" },
];

const FULL_ACCEPT = ".pptx";
const PREVIEW_ACCEPT = ".png,.jpg,.jpeg,.pdf";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mimeToFormat(file: File, kind: SlotKind): string | null {
  const name = file.name.toLowerCase();
  if (kind === "full") {
    return name.endsWith(".pptx") ? "pptx" : null;
  }
  if (name.endsWith(".png")) return "png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "jpg";
  if (name.endsWith(".pdf")) return "pdf";
  return null;
}

// ---------------------------------------------------------------------------
// FileUploadBox — one slot (full or preview)
// ---------------------------------------------------------------------------

interface BoxProps {
  documentId: string;
  language: DocumentLanguage;
  kind: SlotKind;
  sortOrder: number;
  serverMark: "missing" | "uploading" | "ready";
  onReady: () => void;
}

function FileUploadBox({ documentId, language, kind, sortOrder, serverMark, onReady }: BoxProps) {
  const [state, setState] = React.useState<UploadSlotState>({ status: "idle", progress: 0 });
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const xhrRef = React.useRef<XMLHttpRequest | null>(null);

  // Abort any in-flight XHR when the component unmounts to avoid stale state updates.
  React.useEffect(() => {
    return () => { xhrRef.current?.abort(); };
  }, []);

  const isUploading = state.status === "uploading";

  // displayMark always reflects the server's persisted state so the old "Ready"
  // badge stays visible while a re-upload is in progress (AC4).
  const displayMark = serverMark;

  async function handleFile(file: File) {
    const format = mimeToFormat(file, kind);
    if (!format) {
      setState({ status: "failed", error: errorMessage("validation_failed", "file_type"), progress: 0 });
      return;
    }

    setState({ status: "uploading", progress: 0 });

    const startResult = await startDocumentFileUpload({
      documentId,
      kind,
      language,
      sortOrder,
      format,
      sizeBytes: file.size,
    });

    if (!startResult.ok) {
      setState({ status: "failed", error: errorMessage(startResult.code), progress: 0 });
      return;
    }

    const { fileId, uploadUrl } = startResult.upload;

    // Direct upload to R2 via XHR for progress tracking (AC2)
    await new Promise<void>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          setState((s) => ({ ...s, progress: Math.round((e.loaded / e.total) * 100) }));
        }
      });

      xhr.addEventListener("load", async () => {
        xhrRef.current = null;
        // R2 returns non-2xx on rejection; treat those as upload_failed without
        // calling completeDocumentFileUpload (which expects a successful transfer).
        if (xhr.status < 200 || xhr.status >= 300) {
          setState({ status: "failed", error: t("admin.documents.upload.error.upload_failed"), progress: 0 });
          resolve();
          return;
        }
        const completeResult = await completeDocumentFileUpload(fileId);
        if (!completeResult.ok) {
          const reason = completeResult.code === "validation_failed" ? (completeResult as { reason?: string }).reason : undefined;
          // upload_failed uses the domain-specific message, not the generic errors.* one
          const errorText = completeResult.code === "upload_failed"
            ? t("admin.documents.upload.error.upload_failed")
            : errorMessage(completeResult.code, reason);
          setState({ status: "failed", error: errorText, progress: 0 });
        } else {
          setState({ status: "idle", progress: 0 });
          onReady();
        }
        resolve();
      });

      xhr.addEventListener("error", () => {
        xhrRef.current = null;
        setState({ status: "failed", error: t("admin.documents.upload.error.upload_failed"), progress: 0 });
        resolve();
      });

      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
      xhr.send(file);
    });
  }

  function handleCancel() {
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
    setState({ status: "idle", progress: 0 });
  }

  function handleRetry() {
    setState({ status: "idle", progress: 0, error: undefined });
    fileInputRef.current?.click();
  }

  const isPreview = kind === "preview";
  const label = isPreview
    ? t("admin.documents.upload.preview_label").replace("{n}", String(sortOrder))
    : t("admin.documents.upload.full_label");

  const statusLabel = (() => {
    if (displayMark === "ready") return t("admin.documents.upload.status.ready");
    if (displayMark === "uploading") return t("admin.documents.upload.status.uploading");
    return t("admin.documents.upload.status.missing");
  })();

  return (
    <div className="border rounded p-3 space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{statusLabel}</span>
      </div>

      {isUploading ? (
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">
            {t("admin.documents.upload.uploading_progress").replace("{pct}", String(state.progress))}
          </div>
          <div className="w-full bg-muted rounded-full h-1.5">
            <div
              className="bg-primary h-1.5 rounded-full transition-all"
              style={{ width: `${state.progress}%` }}
            />
          </div>
          <button
            type="button"
            onClick={handleCancel}
            className="text-xs text-muted-foreground underline"
          >
            {t("admin.documents.upload.cancel")}
          </button>
        </div>
      ) : state.status === "failed" && state.error ? (
        <div className="space-y-1">
          <p className="text-xs text-destructive">{state.error}</p>
          {state.error === t("admin.documents.upload.error.upload_failed") && (
            <button
              type="button"
              onClick={handleRetry}
              className="text-xs underline"
            >
              {t("admin.documents.upload.retry")}
            </button>
          )}
        </div>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept={kind === "full" ? FULL_ACCEPT : PREVIEW_ACCEPT}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
      {!isUploading && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="text-xs underline"
        >
          {displayMark === "ready"
            ? t("admin.documents.upload.replace")
            : t("admin.documents.upload.choose")}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// LanguageSection — full + preview slots for one language
// ---------------------------------------------------------------------------

interface LanguageSectionProps {
  documentId: string;
  slot: DocumentLanguageSlot;
  onSlotChange: (slot: DocumentLanguageSlot) => void;
}

function LanguageSection({ documentId, slot, onSlotChange }: LanguageSectionProps) {
  const { language, full, previews } = slot;

  function markFullReady() {
    onSlotChange({ ...slot, full: "ready" });
  }

  function markPreviewReady(idx: number) {
    const updated = [...previews] as DocumentLanguageSlot["previews"];
    updated[idx] = "ready";
    onSlotChange({ ...slot, previews: updated });
  }

  // Show preview slot N+1 only if slot N is ready
  const showPreview2 = previews[0] === "ready";
  const showPreview3 = previews[1] === "ready";

  return (
    <div className="space-y-2">
      <FileUploadBox
        documentId={documentId}
        language={language}
        kind="full"
        sortOrder={1}
        serverMark={full}
        onReady={markFullReady}
      />
      <FileUploadBox
        documentId={documentId}
        language={language}
        kind="preview"
        sortOrder={1}
        serverMark={previews[0]}
        onReady={() => markPreviewReady(0)}
      />
      {showPreview2 && (
        <FileUploadBox
          documentId={documentId}
          language={language}
          kind="preview"
          sortOrder={2}
          serverMark={previews[1]}
          onReady={() => markPreviewReady(1)}
        />
      )}
      {showPreview3 && (
        <FileUploadBox
          documentId={documentId}
          language={language}
          kind="preview"
          sortOrder={3}
          serverMark={previews[2]}
          onReady={() => markPreviewReady(2)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DocumentLanguageFiles — public export
// ---------------------------------------------------------------------------

export function DocumentLanguageFiles({ documentId, slots, onSlotsChange }: Props) {
  function handleSlotChange(lang: DocumentLanguage, updated: DocumentLanguageSlot) {
    onSlotsChange(slots.map((s) => (s.language === lang ? updated : s)));
  }

  return (
    <div className="space-y-6">
      {LANGUAGES.map(({ code, labelKey }) => {
        const slot = slots.find((s) => s.language === code) ?? {
          language: code,
          full: "missing" as const,
          previews: ["missing", "missing", "missing"] as DocumentLanguageSlot["previews"],
        };
        return (
          <section key={code} aria-labelledby={`lang-${code}`}>
            <h3 id={`lang-${code}`} className="font-semibold mb-2">
              {t(labelKey as Parameters<typeof t>[0])}
            </h3>
            <LanguageSection
              documentId={documentId}
              slot={slot}
              onSlotChange={(updated) => handleSlotChange(code, updated)}
            />
          </section>
        );
      })}
    </div>
  );
}
