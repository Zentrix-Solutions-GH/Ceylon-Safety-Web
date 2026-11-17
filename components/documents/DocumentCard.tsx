"use client";

import { t } from "@/messages/en";
import type { PublicDocumentCard } from "@/types/document";

const PLACEHOLDER = "/images/document-placeholder.jpg";

interface DocumentCardProps {
  doc: PublicDocumentCard;
  mediaBase: string;
  onOpen: (slug: string) => void;
}

export function DocumentCard({ doc, mediaBase, onOpen }: DocumentCardProps) {
  const imgSrc = doc.coverImageKey ? `${mediaBase}/${doc.coverImageKey}` : PLACEHOLDER;
  const price = (doc.priceCents / 100).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <article
      tabIndex={0}
      onClick={() => onOpen(doc.slug)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onOpen(doc.slug); }}
      className="group flex cursor-pointer flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition hover:shadow-md"
    >
      <div className="relative aspect-video overflow-hidden bg-gray-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imgSrc}
          alt={doc.title}
          loading="lazy"
          className="h-full w-full object-cover transition group-hover:scale-105"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = PLACEHOLDER;
          }}
        />
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        {doc.categoryName && (
          <span className="text-xs font-semibold uppercase tracking-wide text-red-600">
            {doc.categoryName}
          </span>
        )}

        <h3 className="line-clamp-2 text-sm font-semibold text-gray-900">{doc.title}</h3>

        {doc.unavailable && (
          <span className="text-xs text-gray-400">{t("documents.card.unavailable")}</span>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-1">
          {doc.languages.map((lang) => (
            <span
              key={lang}
              className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium uppercase text-gray-600"
            >
              {lang}
            </span>
          ))}
        </div>

        <p className="text-sm font-bold text-gray-900">
          {t("documents.card.price", { price })}
        </p>
      </div>
    </article>
  );
}

export default DocumentCard;
