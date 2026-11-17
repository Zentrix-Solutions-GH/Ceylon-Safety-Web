import type { Metadata } from "next";
import { listPublicDocuments } from "@/lib/documents/public";
import { publicConfig } from "@/lib/config.public";
import { DocumentFilters } from "@/components/documents/DocumentFilters";
import { DocumentsPageClient } from "@/components/documents/DocumentsPageClient";
import { t } from "@/messages/en";
import type { DocKind } from "@/types/document";

interface DocumentsPageProps {
  searchParams: Promise<Record<string, string>>;
}

export const metadata: Metadata = {
  title: t("documents.page.title"),
  description: t("documents.page.description"),
  alternates: { canonical: "/documents" },
};

// AC6: s-maxage=60, stale-while-revalidate
export const revalidate = 60;

function resolveType(raw: string | undefined): DocKind | undefined {
  const valid: DocKind[] = ["checklist", "safety_sign", "toolbox_talk"];
  if (!raw) return undefined;
  return (valid as string[]).includes(raw) ? (raw as DocKind) : undefined;
}

export default async function DocumentsPage({ searchParams }: DocumentsPageProps) {
  const params = await searchParams;
  const category = params.category || undefined;
  const type = resolveType(params.type);
  const result = await listPublicDocuments({ category, type });
  const docs = result.ok ? result.data.documents : [];

  // Always fetch the full unfiltered list to populate the category dropdown and
  // the allSlugs set (EC2: guard against deleted/unpublished slugs across all
  // pages of the catalog, not just the current filtered view).
  const allResult = await listPublicDocuments({});
  const allDocs = allResult.ok ? allResult.data.documents : [];
  const fullMap = new Map<string, string>();
  for (const doc of allDocs) {
    if (doc.categoryId && doc.categoryName) {
      fullMap.set(doc.categoryId, doc.categoryName);
    }
  }
  const allCategories = Array.from(fullMap.entries()).map(([id, name]) => ({ id, name }));
  const allSlugs = allDocs.map((d) => d.slug);

  const mediaBase = publicConfig.mediaCdnUrl;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold text-gray-900">{t("documents.page.title")}</h1>

      <DocumentFilters categories={allCategories} />

      <DocumentsPageClient docs={docs} mediaBase={mediaBase} allSlugs={allSlugs} />
    </div>
  );
}
