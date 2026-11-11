"use client";

import { t } from "@/messages/en";

export type ImageBlockStatus = "uploading" | "pending" | "ready" | "error" | "upload_failed";

interface ImageBlockProps {
  mediaId: string | null;
  previewSrc: string;
  alt: string;
  decorative: boolean;
  caption: string;
  status: ImageBlockStatus;
  onRemove: () => void;
  onRetry: () => void;
}

export default function ImageBlock({
  previewSrc,
  alt,
  decorative,
  status,
  onRemove,
  onRetry,
}: ImageBlockProps) {
  if (status === "uploading") {
    return (
      <div className="image-block image-block--uploading" role="status">
        <span>{t("editor.image.resizing")}</span>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="image-block image-block--error" role="alert">
        <p>{t("editor.image.upload_failed")}</p>
        <button type="button" aria-label={t("editor.image.retry")} onClick={onRetry}>
          {t("editor.image.retry")}
        </button>
        <button type="button" aria-label={t("editor.image.remove")} onClick={onRemove}>
          {t("editor.image.remove")}
        </button>
      </div>
    );
  }

  if (status === "upload_failed") {
    return (
      <div className="image-block image-block--upload-failed" role="alert">
        <p>{t("editor.image.upload_failed")}</p>
        <button type="button" aria-label={t("editor.image.remove")} onClick={onRemove}>
          {t("editor.image.remove")}
        </button>
      </div>
    );
  }

  return (
    <figure className="image-block">
      {status === "pending" && (
        <p role="alert" className="image-block__pending">
          {t("editor.image.upload_not_complete")}
        </p>
      )}

      {/* Always render img when ready/pending so alt can be tested; hide empty src visually */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={previewSrc || undefined}
        alt={decorative ? "" : alt}
        className="image-block__preview"
        aria-hidden={!previewSrc ? true : undefined}
      />

      {decorative && (
        <span className="image-block__decorative sr-only">
          {t("editor.image.decorative_indicator")}
        </span>
      )}

      <button
        type="button"
        aria-label={t("editor.image.remove")}
        className="image-block__remove"
        onClick={onRemove}
      >
        {t("editor.image.remove")}
      </button>
    </figure>
  );
}
