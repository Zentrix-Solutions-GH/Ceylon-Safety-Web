import type { Metadata } from "next";
import { Suspense } from "react";
import { listPublicDocuments, listAllDocumentSlugsAndCategories } from "@/lib/documents/public";
import { publicConfig } from "@/lib/config.public";
import { DocumentSidebar } from "@/components/documents/DocumentSidebar";
import { DocumentsPageClient } from "@/components/documents/DocumentsPageClient";
import DocumentModal from "@/components/documents/DocumentModal";
import { ArticlesHeroSlideshow } from "@/components/articles/ArticlesHeroSlideshow";
import { HeroSearchForm } from "@/components/articles/HeroSearchForm";
import { t } from "@/messages/en";
import type { DocKind, DocumentCategory } from "@/types/document";

interface DocumentsPageProps {
  searchParams: Promise<Record<string, string>>;
}

export const metadata: Metadata = {
  title: t("documents.page.title"),
  description: t("documents.page.description"),
  alternates: { canonical: "/documents" },
};

export const revalidate = 60;

function resolveType(raw: string | undefined): DocKind | undefined {
  const valid: DocKind[] = ["checklist", "safety_sign", "toolbox_talk"];
  if (!raw) return undefined;
  return (valid as string[]).includes(raw) ? (raw as DocKind) : undefined;
}

function resolveSort(raw: string | undefined): "newest" | "popular" {
  return raw === "popular" ? "popular" : "newest";
}

function resolvePage(raw: string | undefined): number {
  const n = parseInt(raw ?? "1", 10);
  return isNaN(n) || n < 1 ? 1 : n;
}

export default async function DocumentsPage({ searchParams }: DocumentsPageProps) {
  const params = await searchParams;
  const category = params.category || undefined;
  const type = resolveType(params.type);
  const sort = resolveSort(params.sort);
  const page = resolvePage(params.page);

  const [result, allItems] = await Promise.all([
    listPublicDocuments({ category, type, sort, page }),
    listAllDocumentSlugsAndCategories(),
  ]);
  const docs = result.ok ? result.data.documents : [];
  const total = result.ok ? result.data.total : 0;
  const pageSize = result.ok ? result.data.pageSize : 12;
  const allSlugs = allItems.map((d) => d.slug);
  const fullMap = new Map<string, string>();
  for (const item of allItems) {
    if (item.categoryId && item.categoryName) {
      fullMap.set(item.categoryId, item.categoryName);
    }
  }
  const allCategories: DocumentCategory[] = Array.from(fullMap.entries()).map(([id, name]) => ({ id, name }));

  const mediaBase = publicConfig.mediaCdnUrl;

  return (
    <div>
      {/* Hero Banner */}
      <div className="relative overflow-hidden bg-gray-900">
        <ArticlesHeroSlideshow />
        <div className="relative mx-auto max-w-6xl px-4 py-14 text-white">
          <div className="max-w-2xl">
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-red-300">
              {t("auth.brand.wordmark")}
            </p>
            <h1 className="mb-3 text-4xl font-extrabold tracking-tight sm:text-5xl">
              {t("documents.page.title")}
            </h1>
            <p className="mb-8 text-sm text-gray-300 sm:text-base">
              {t("documents.page.description")}
            </p>
            <HeroSearchForm scope="documents" />
          </div>
        </div>
      </div>

      {/* Sidebar + Grid */}
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex gap-6">
          {/* Sidebar */}
          <aside className="hidden w-64 shrink-0 lg:block">
            <DocumentSidebar categories={allCategories} />
          </aside>

          {/* Main content */}
          <div className="min-w-0 flex-1">
            <DocumentsPageClient
              docs={docs}
              mediaBase={mediaBase}
              allSlugs={allSlugs}
              allCategories={allCategories}
              total={total}
              pageSize={pageSize}
              currentPage={page}
              sort={sort}
            />
          </div>
        </div>
      </div>

      <Suspense fallback={null}>
        <DocumentModal />
      </Suspense>
    </div>
  );
}
