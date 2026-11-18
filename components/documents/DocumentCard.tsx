"use client";

import { useState } from "react";
import { t } from "@/messages/en";
import type { PublicDocumentCard } from "@/types/document";

const PLACEHOLDER = "/images/document-placeholder.jpg";

const KIND_CONFIG: Record<string, { label: string; color: string }> = {
  checklist: { label: "PDF Documents", color: "bg-amber-500" },
  safety_sign: { label: "Safety Sign", color: "bg-green-600" },
  toolbox_talk: { label: "Toolbox Talk", color: "bg-blue-600" },
};

function deriveStars(downloads: number): number {
  if (downloads >= 200) return 5;
  if (downloads >= 100) return 4.5;
  if (downloads >= 50) return 4;
  if (downloads >= 20) return 3.5;
  return 3;
}

function StarRating({ value }: { value: number }) {
  const full = Math.floor(value);
  const half = value % 1 >= 0.5;
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => {
        const filled = i < full;
        const isHalf = !filled && i === full && half;
        return (
          <svg key={i} className={`h-3 w-3 ${filled || isHalf ? "text-yellow-400" : "text-gray-300"}`} fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        );
      })}
      <span className="ml-1 text-[10px] text-gray-500">{value.toFixed(1)}</span>
    </span>
  );
}

interface DocumentCardProps {
  doc: PublicDocumentCard;
  mediaBase: string;
  onOpen: (slug: string) => void;
}

export function DocumentCard({ doc, mediaBase, onOpen }: DocumentCardProps) {
  const [imgSrc, setImgSrc] = useState(
    doc.coverImageKey ? `${mediaBase}/${doc.coverImageKey}` : PLACEHOLDER
  );

  const isFree = doc.priceCents === 0;
  const price = (doc.priceCents / 100).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const stars = deriveStars(doc.downloadCount);
  const kindConfig = KIND_CONFIG[doc.docKind] ?? { label: doc.docKind, color: "bg-gray-600" };

  return (
    <article
      className="group flex cursor-pointer flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:shadow-lg"
      onClick={() => onOpen(doc.slug)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onOpen(doc.slug); }}
      tabIndex={0}
    >
      {/* Cover image */}
      <div className="relative overflow-hidden bg-gray-100" style={{ aspectRatio: "4/3" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imgSrc}
          alt={doc.title}
          loading="lazy"
          className="h-full w-full object-cover transition group-hover:scale-105"
          onError={() => setImgSrc(PLACEHOLDER)}
        />
        {/* Doc-kind badge */}
        <span className={`absolute left-2 top-2 rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow ${kindConfig.color}`}>
          {kindConfig.label}
        </span>
      </div>

      {/* Card body */}
      <div className="flex flex-1 flex-col p-3">
        {/* Category */}
        {doc.categoryName && (
          <span className="mb-1 text-[10px] font-bold uppercase tracking-widest text-red-600">
            {doc.categoryName}
          </span>
        )}

        {/* Title */}
        <h3 className="mb-2 line-clamp-2 text-sm font-bold leading-snug text-gray-900">
          {doc.title}
        </h3>

        {/* Stats row: pages + downloads + stars */}
        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500">
          {doc.pageCount != null && (
            <span className="flex items-center gap-1">
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              {t("documents.card.pages", { n: String(doc.pageCount) })}
            </span>
          )}
          <span className="flex items-center gap-1">
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            {doc.downloadCount}
          </span>
          <StarRating value={stars} />
        </div>

        {/* Language chips */}
        {doc.languages.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {doc.languages.map((lang) => (
              <span
                key={lang}
                className="rounded bg-gray-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-gray-600"
              >
                {lang}
              </span>
            ))}
          </div>
        )}

        {/* Spacer */}
        <div className="mt-auto" />

        {/* Price + CTA */}
        <div className="flex items-center justify-between gap-2 border-t border-gray-100 pt-2">
          <div>
            {doc.unavailable ? (
              <span className="text-xs text-gray-400">{t("documents.card.unavailable")}</span>
            ) : isFree ? (
              <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700">
                {t("documents.card.free")}
              </span>
            ) : (
              <span className="text-sm font-extrabold text-gray-900">
                Rs.&nbsp;{price}
              </span>
            )}
          </div>
          <button
            type="button"
            disabled={doc.unavailable}
            onClick={(e) => { e.stopPropagation(); onOpen(doc.slug); }}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
              isFree
                ? "border border-red-600 text-red-600 hover:bg-red-50"
                : "bg-red-600 text-white hover:bg-red-700"
            }`}
          >
            {isFree ? t("documents.card.get_free") : t("documents.card.add_to_cart")}
          </button>
        </div>
      </div>
    </article>
  );
}

export default DocumentCard;
