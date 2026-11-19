"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { DocumentCard } from "@/components/documents/DocumentCard";
import { publicConfig } from "@/lib/config.public";
import type { PublicDocumentCard } from "@/types/document";

interface Props {
  docs: PublicDocumentCard[];
}

function PopularDocumentsGrid({ docs }: Props) {
  const router = useRouter();
  const mediaBase = publicConfig.mediaCdnUrl;

  return (
    <section className="bg-gray-50 py-10">
      <div className="mx-auto max-w-6xl px-4">
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
            className="mt-1 whitespace-nowrap text-sm font-medium text-primary hover:underline"
          >
            View all documents →
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {docs.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              mediaBase={mediaBase}
              onOpen={(slug) => router.push(`/documents/${slug}`)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export { PopularDocumentsGrid };
