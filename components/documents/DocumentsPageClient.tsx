"use client";

import { useRef, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { DocumentGrid } from "./DocumentGrid";
import { DocumentModal } from "./DocumentModal";
import type { PublicDocumentCard } from "@/types/document";

interface DocumentsPageClientProps {
  docs: PublicDocumentCard[];
  mediaBase: string;
  allSlugs: string[];
}

export function DocumentsPageClient({ docs, mediaBase, allSlugs }: DocumentsPageClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const scrollRef = useRef<number>(0);
  const prevModalSlugRef = useRef<string | null>(null);

  // EC3: detect whether any filter is active for the empty-state message
  const isFiltered = Boolean(searchParams.get("category") || searchParams.get("type"));

  // EC2: guard against slugs that are not published/deleted.
  // Use allSlugs (from the server's unfiltered fetch) so a valid document
  // outside the current filter still opens the modal.
  const knownSlugs = new Set(allSlugs);

  // AC4: sync modal state with ?document= param; guard against unknown slugs (EC2)
  const rawParam = searchParams.get("document");
  const modalSlug = rawParam && knownSlugs.has(rawParam) ? rawParam : null;

  // EC6: capture scroll when modal opens (including direct-URL opens where onOpen
  // never fires); restore it when modal closes. useEffect runs synchronously in
  // tests and avoids a setTimeout race in the browser.
  useEffect(() => {
    const wasOpen = prevModalSlugRef.current !== null;
    const isOpen = modalSlug !== null;
    if (!wasOpen && isOpen) {
      scrollRef.current = window.scrollY;
    } else if (wasOpen && !isOpen) {
      window.scrollTo({ top: scrollRef.current });
    }
    prevModalSlugRef.current = modalSlug;
  }, [modalSlug]);

  function onOpen(slug: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("document", slug);
    // EC6: use push so browser-back closes the modal
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function onClose() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("document");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <>
      <DocumentGrid docs={docs} mediaBase={mediaBase} onOpen={onOpen} isFiltered={isFiltered} />
      <DocumentModal slug={modalSlug} onClose={onClose} />
    </>
  );
}
