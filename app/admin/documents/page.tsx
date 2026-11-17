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

const VALID_STATUSES: DocumentStatus[] = ["draft", "published", "hidden"];
const VALID_KINDS: DocKind[] = ["checklist", "safety_sign", "toolbox_talk"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdminDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const rawPage = params.page ? parseInt(params.page, 10) : 1;
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1;

  const status = VALID_STATUSES.includes(params.status as DocumentStatus)
    ? (params.status as DocumentStatus)
    : undefined;
  const docKind = VALID_KINDS.includes(params.kind as DocKind)
    ? (params.kind as DocKind)
    : undefined;

  const [listResult, categories] = await Promise.all([
    listDocuments({
      status,
      docKind,
      categoryId: params.category && UUID_RE.test(params.category) ? params.category : undefined,
      search: params.search?.slice(0, 200),
      page,
    }),
    listCategories(),
  ]);

  if (!listResult.ok) {
    redirect("/admin");
  }

  return (
    <DocumentsPageClient
      initialRows={listResult.rows}
      total={listResult.total}
      page={listResult.page}
      pageSize={listResult.pageSize}
      categories={categories}
      initialStatus={status ?? ""}
      initialKind={docKind ?? ""}
      initialCategory={params.category ?? ""}
      initialTitle={params.search ?? ""}
    />
  );
}
