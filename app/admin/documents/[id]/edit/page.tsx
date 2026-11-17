import { notFound, redirect } from "next/navigation";
import { getDocument } from "@/lib/admin/actions/documents";
import { listCategories } from "@/lib/articles/listCategories";
import { DocumentForm } from "@/components/admin/DocumentForm";

export const metadata = { robots: "noindex,nostore" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditDocumentPage({ params }: PageProps) {
  const { id } = await params;

  if (!UUID_RE.test(id)) notFound();

  const [docResult, categories] = await Promise.all([
    getDocument(id),
    listCategories(),
  ]);

  if (!docResult.ok) {
    if (docResult.code === "not_allowed") redirect("/admin");
    notFound();
  }

  return (
    <DocumentForm
      mode="edit"
      document={docResult.document}
      categories={categories}
    />
  );
}
