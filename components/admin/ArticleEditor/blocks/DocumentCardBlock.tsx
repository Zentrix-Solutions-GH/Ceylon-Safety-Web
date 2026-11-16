"use client";

import { publicConfig } from "@/lib/config.public";
import { t } from "@/messages/en";

interface DocumentCardBlockProps {
  documentId: string;
  slug: string;
  title: string;
  price: number;
  previewUrl?: string;
  onRemove: () => void;
}

export default function DocumentCardBlock({
  title,
  price,
  previewUrl,
  onRemove,
}: DocumentCardBlockProps) {
  const thumbSrc = previewUrl
    ? previewUrl.startsWith("http")
      ? previewUrl
      : `${publicConfig.mediaCdnUrl}/${previewUrl}`
    : null;

  const priceLKR = (price / 100).toLocaleString("en-LK", {
    style: "currency",
    currency: "LKR",
    minimumFractionDigits: 0,
  });

  return (
    <figure className="document-card-block">
      {thumbSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumbSrc} alt={title} className="document-card-block__thumbnail" />
      ) : (
        <div className="document-card-block__thumbnail-placeholder" aria-hidden="true" />
      )}
      <figcaption className="document-card-block__info">
        <span className="document-card-block__title">{title}</span>
        <span className="document-card-block__price">{priceLKR}</span>
        <span className="document-card-block__label">{t("editor.document_card.view_label")}</span>
      </figcaption>
      <button
        type="button"
        aria-label={t("editor.document_card.remove")}
        className="document-card-block__remove"
        onClick={onRemove}
      >
        {t("editor.document_card.remove")}
      </button>
    </figure>
  );
}
