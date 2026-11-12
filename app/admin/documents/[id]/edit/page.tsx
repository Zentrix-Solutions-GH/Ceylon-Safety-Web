import { notFound } from "next/navigation";
import { getDocument } from "@/lib/admin/actions/documents";
import { listCategories } from "@/lib/articles/listCategories";
import { DocumentForm } from "@/components/admin/DocumentForm";

export const metadata = { robots: "noindex,nostore" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditDocumentPage({ params }: PageProps) {
  const { id } = await params;

  const [docResult, categories] = await Promise.all([
    getDocument(id),
    listCategories(),
  ]);

  if (!docResult.ok) {
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
