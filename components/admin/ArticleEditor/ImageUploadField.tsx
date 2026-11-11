"use client";

import { useRef, useState, useEffect } from "react";
import { resizeImage } from "@/lib/content/image-resize";
import { useMediaUpload } from "@/hooks/useMediaUpload";
import { t } from "@/messages/en";
import type { AllowedImageMime } from "@/types/media";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_ALT_LENGTH = 200;
const MAX_CAPTION_LENGTH = 200;

interface ImageUploadFieldProps {
  onInsert: (attrs: {
    mediaId: string;
    previewSrc: string;
    alt: string;
    decorative: boolean;
    caption: string;
  }) => void;
  onCancel: () => void;
}

export default function ImageUploadField({ onInsert, onCancel }: ImageUploadFieldProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [alt, setAlt] = useState("");
  const [decorative, setDecorative] = useState(false);
  const [caption, setCaption] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);
  const [altError, setAltError] = useState<string | null>(null);
  const [resizeStatus, setResizeStatus] = useState<"idle" | "resizing">("idle");
  const [previewSrc, setPreviewSrc] = useState("");
  const [pendingMediaId, setPendingMediaId] = useState<string | null>(null);
  const originalMimeRef = useRef<AllowedImageMime>("image/jpeg");
  const variantsRef = useRef<Awaited<ReturnType<typeof resizeImage>> | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  // Revoke any outstanding blob URL on unmount
  useEffect(() => () => { if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current); }, []);

  const { status: uploadStatus, errorCode, upload, retry } = useMediaUpload({
    onSuccess: (mediaId) => {
      setPendingMediaId(mediaId);
    },
    onError: () => {},
    onUploadFailed: () => {},
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError(null);

    if (!ALLOWED_MIME.has(file.type)) {
      setFileError(t("editor.image.file_type_not_allowed"));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFileError(t("editor.image.file_too_large"));
      return;
    }

    setResizeStatus("resizing");
    try {
      const variants = await resizeImage(file);
      variantsRef.current = variants;
      originalMimeRef.current = file.type as AllowedImageMime;

      // Build local preview from the smallest variant; revoke the previous blob URL
      const smallest = variants.reduce((a, b) => (a.width <= b.width ? a : b));
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      const newUrl = URL.createObjectURL(smallest.blob);
      blobUrlRef.current = newUrl;
      setPreviewSrc(newUrl);

      setResizeStatus("idle");
      await upload(variants, file.type as AllowedImageMime);
    } catch (err: unknown) {
      setResizeStatus("idle");
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("5 MB") || msg.includes("exceeds")) {
        setFileError(t("editor.image.file_too_large"));
      } else if (msg.includes("6000") || msg.includes("dimensions")) {
        setFileError(t("editor.image.dimension_too_large"));
      } else if (msg.includes("Unsupported")) {
        setFileError(t("editor.image.file_type_not_allowed"));
      } else {
        setFileError(t("editor.image.could_not_process"));
      }
    }
  }

  function handleInsert(e: React.FormEvent) {
    e.preventDefault();
    if (!decorative && !alt.trim()) {
      setAltError(t("editor.image.alt_required"));
      return;
    }
    if (!pendingMediaId) return;
    // Transfer blob URL ownership to the inserted node before unmounting —
    // clearing blobUrlRef prevents the cleanup from revoking a URL the editor still needs.
    const src = previewSrc;
    blobUrlRef.current = null;
    onInsert({ mediaId: pendingMediaId, previewSrc: src, alt, decorative, caption });
  }

  const canInsert = pendingMediaId !== null && uploadStatus === "ready";
  const isUploading = resizeStatus === "resizing" || uploadStatus === "uploading" || uploadStatus === "pending";

  return (
    <form onSubmit={handleInsert} className="image-upload-field">
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label={t("editor.toolbar.insert_image")}
        onChange={handleFileChange}
      />

      {fileError && <p role="alert" className="image-upload-field__error">{fileError}</p>}
      {resizeStatus === "resizing" && <p role="status">{t("editor.image.resizing")}</p>}
      {uploadStatus === "uploading" && <p role="status">{t("editor.image.uploading")}</p>}

      {uploadStatus === "error" && errorCode === "rate_limited" && (
        <p role="alert">{t("editor.image.rate_limited")}</p>
      )}
      {uploadStatus === "error" && errorCode !== "rate_limited" && (
        <div role="alert">
          <p>{t("editor.image.upload_failed")}</p>
          <button type="button" onClick={() => retry()}>{t("editor.image.retry")}</button>
        </div>
      )}
      {uploadStatus === "upload_failed" && errorCode === "location_data_found" && (
        <p role="alert">{t("editor.image.location_data_found")}</p>
      )}
      {uploadStatus === "upload_failed" && errorCode !== "location_data_found" && (
        <p role="alert">{t("editor.image.upload_failed")}</p>
      )}

      {previewSrc && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewSrc} alt="" className="image-upload-field__preview" aria-hidden />
      )}

      <div>
        <label htmlFor="image-alt">{t("editor.image.alt_label")}</label>
        <input
          id="image-alt"
          type="text"
          value={alt}
          maxLength={MAX_ALT_LENGTH}
          disabled={decorative}
          onChange={(e) => { setAlt(e.target.value); setAltError(null); }}
          aria-required={!decorative}
        />
        {altError && <span role="alert">{altError}</span>}
      </div>

      <div>
        <label>
          <input
            type="checkbox"
            checked={decorative}
            onChange={(e) => { setDecorative(e.target.checked); setAltError(null); }}
          />
          {t("editor.image.decorative_label")}
        </label>
      </div>

      <div>
        <label htmlFor="image-caption">{t("editor.image.caption_label")}</label>
        <input
          id="image-caption"
          type="text"
          value={caption}
          maxLength={MAX_CAPTION_LENGTH}
          onChange={(e) => setCaption(e.target.value)}
          placeholder={t("editor.image.caption_placeholder")}
        />
      </div>

      <button type="submit" disabled={!canInsert || isUploading}>
        {t("editor.image.insert")}
      </button>
      <button type="button" onClick={onCancel}>
        {t("editor.image.cancel")}
      </button>
    </form>
  );
}
