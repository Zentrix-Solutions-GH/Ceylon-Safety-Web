import { redirect } from "next/navigation";
import { listDocuments } from "@/lib/admin/actions/documents";
import { listCategories } from "@/lib/articles/listCategories";
import DocumentsPageClient from "./DocumentsPageClient";
import type { DocumentStatus, DocKind } from "@/types/document";

export const dynamic = "force-dynamic";
export const metadata = { robots: "noindex,nostore" };

type SearchParams = {
  status?: string;
  kind?: string;
  category?: string;
  search?: string;
  page?: string;
};

export default async function AdminDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const rawPage = params.page ? parseInt(params.page, 10) : 1;
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1;

  const [listResult, categories] = await Promise.all([
    listDocuments({
      status: params.status as DocumentStatus | undefined,
      docKind: params.kind as DocKind | undefined,
      categoryId: params.category,
      search: params.search,
      page,
    }),
    listCategories(),
  ]);

  if (!listResult.ok) {
    if (listResult.code === "not_allowed") redirect("/admin");
    redirect("/admin/documents");
  }

  return (
    <DocumentsPageClient
      initialRows={listResult.rows}
      total={listResult.total}
      page={listResult.page}
      pageSize={listResult.pageSize}
      categories={categories}
      initialStatus={(params.status ?? "") as DocumentStatus | ""}
      initialKind={(params.kind ?? "") as DocKind | ""}
      initialCategory={params.category ?? ""}
      initialTitle={params.search ?? ""}
    />
  );
}
