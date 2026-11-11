import Link from "next/link";
import Image from "next/image";
import { Star } from "lucide-react";
import { listPublicDocuments } from "@/lib/documents/public";
import { publicUrl } from "@/lib/media/publicUrl";
import type { PublicDocumentCard } from "@/types/document";

function DocumentCard({ doc }: { doc: PublicDocumentCard }) {
  const price = (doc.priceCents / 100).toLocaleString("en-LK");
  const downloads = doc.downloadCount >= 1000
    ? `${(doc.downloadCount / 1000).toFixed(1)}k`
    : String(doc.downloadCount);

  let imgSrc: string | null = null;
  try {
    imgSrc = doc.coverImageKey ? publicUrl(doc.coverImageKey) : null;
  } catch {
    imgSrc = null;
  }

  return (
    <Link
      href={`/documents/${doc.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow"
    >
      {/* Thumbnail */}
      <div className="relative h-32 overflow-hidden bg-gray-100">
        {imgSrc ? (
          <Image
            src={imgSrc}
            alt={doc.title}
            fill
            className="object-cover object-center group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-red-50 to-red-100">
            <span className="text-3xl">📄</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        <span className="absolute left-2 top-2 rounded-full bg-green-500 px-2 py-0.5 text-[10px] font-semibold text-white">
          Safety Compliant
        </span>
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col p-3">
        <p className="mb-2 line-clamp-2 text-xs font-semibold leading-snug text-gray-800">
          {doc.title}
        </p>
        {/* Rating placeholder — not stored per document, show static stars */}
        <div className="mb-2 flex items-center gap-1">
          <div className="flex">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={`h-3 w-3 ${i < 4 ? "fill-yellow-400 text-yellow-400" : "fill-gray-200 text-gray-200"}`}
              />
            ))}
          </div>
          {doc.downloadCount > 0 && (
            <span className="ml-auto text-[10px] text-gray-400">{downloads} Downloads</span>
          )}
        </div>
        {/* Price + Buy */}
        <div className="mt-auto flex items-center justify-between">
          <div>
            <p className="text-[10px] text-gray-400">From</p>
            <p className="text-sm font-bold text-gray-900">Rs. {price}</p>
          </div>
          <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white group-hover:bg-primary-dark transition-colors">
            Buy
          </span>
        </div>
      </div>
    </Link>
  );
}

export async function PopularDocuments() {
  const result = await listPublicDocuments({ sort: "popular", page: 1 }).catch(() => ({ ok: false as const, code: "unknown" as const, reason: "fetch failed" }));

  if (!result.ok || result.data.documents.length === 0) return null;

  const docs = result.data.documents.slice(0, 4);

  return (
    <section className="bg-gray-50 py-10">
      <div className="mx-auto max-w-6xl px-4">
        {/* Section header */}
        <div className="mb-5 flex items-start justify-between">
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-widest text-primary">
              Statutory Compliance
            </p>
            <h2 className="text-xl font-bold text-gray-900">
              Popular Statutory Documents &amp; Templates
            </h2>
          </div>
          <Link
            href="/documents"
            className="text-sm font-medium text-primary hover:underline whitespace-nowrap mt-1"
          >
            View all documents →
          </Link>
        </div>

        {/* Document cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {docs.map((doc) => (
            <DocumentCard key={doc.id} doc={doc} />
          ))}
        </div>
      </div>
    </section>
  );
}
