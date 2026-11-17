"use client";

import { DocumentCard } from "./DocumentCard";
import { t } from "@/messages/en";
import type { PublicDocumentCard } from "@/types/document";

interface DocumentGridProps {
  docs: PublicDocumentCard[];
  mediaBase: string;
  onOpen: (slug: string) => void;
  isFiltered?: boolean;
}

export function DocumentGrid({ docs, mediaBase, onOpen, isFiltered = false }: DocumentGridProps) {
  if (docs.length === 0) {
    return (
      <div className="mt-10 flex flex-col items-center gap-4 py-16 text-center text-gray-500">
        <p>{isFiltered ? t("documents.empty.filtered") : t("documents.empty.all")}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {docs.map((doc) => (
        <DocumentCard key={doc.id} doc={doc} mediaBase={mediaBase} onOpen={onOpen} />
      ))}
    </div>
  );
}

export default DocumentGrid;
