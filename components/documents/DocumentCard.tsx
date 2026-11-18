"use client";

import { useState } from "react";
import { t } from "@/messages/en";
import type { PublicDocumentCard } from "@/types/document";

const PLACEHOLDER = "/images/document-placeholder.jpg";

const KIND_LABELS: Record<string, string> = {
  checklist: "Checklist",
  safety_sign: "Safety Sign",
  toolbox_talk: "Toolbox Talk",
};

interface DocumentCardProps {
  doc: PublicDocumentCard;
  mediaBase: string;
  onOpen: (slug: string) => void;
}

export function DocumentCard({ doc, mediaBase, onOpen }: DocumentCardProps) {
  const [imgSrc, setImgSrc] = useState(
    doc.coverImageKey ? `${mediaBase}/${doc.coverImageKey}` : PLACEHOLDER
  );
  const price = (doc.priceCents / 100).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <article
      className="group flex cursor-pointer flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition hover:shadow-md"
      onClick={() => onOpen(doc.slug)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onOpen(doc.slug); }}
      tabIndex={0}
    >
      {/* Cover image */}
      <div className="relative aspect-video overflow-hidden bg-gray-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imgSrc}
          alt={doc.title}
          loading="lazy"
          className="h-full w-full object-cover transition group-hover:scale-105"
          onError={() => setImgSrc(PLACEHOLDER)}
        />
        {/* Doc-kind badge */}
        <span className="absolute left-2 top-2 rounded bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow">
          {KIND_LABELS[doc.docKind] ?? doc.docKind}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        {/* Category */}
        {doc.categoryName && (
          <span className="text-[11px] font-semibold uppercase tracking-wide text-red-600">
            {doc.categoryName}
          </span>
        )}

        {/* Title */}
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-gray-900">
          {doc.title}
        </h3>

        {/* Page count + downloads */}
        <div className="flex gap-3 text-[11px] text-gray-400">
          {doc.pageCount != null && (
            <span>{t("documents.card.pages", { n: String(doc.pageCount) })}</span>
          )}
          <span>{t("documents.card.downloads", { n: String(doc.downloadCount) })}</span>
        </div>

        {/* Language chips */}
        {doc.languages.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {doc.languages.map((lang) => (
              <span
                key={lang}
                className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-gray-600"
              >
                {lang}
              </span>
            ))}
          </div>
        )}

        {/* Price + CTA */}
        <div className="mt-auto space-y-2 pt-2">
          {doc.unavailable ? (
            <p className="text-xs text-gray-400">{t("documents.card.unavailable")}</p>
          ) : (
            <p className="text-base font-bold text-gray-900">
              {t("documents.card.price", { price })}
            </p>
          )}

          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              disabled={doc.unavailable}
              onClick={(e) => { e.stopPropagation(); onOpen(doc.slug); }}
              className="flex-1 rounded bg-red-600 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Add to Cart
            </button>
            <button
              type="button"
              disabled={doc.unavailable}
              onClick={(e) => { e.stopPropagation(); onOpen(doc.slug); }}
              className="flex-1 rounded border border-red-600 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Buy Now
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

export default DocumentCard;
