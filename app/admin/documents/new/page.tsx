import { listCategories } from "@/lib/articles/listCategories";
import { DocumentForm } from "@/components/admin/DocumentForm";

export const metadata = { robots: "noindex,nostore" };

export default async function NewDocumentPage() {
  const categories = await listCategories();
  return <DocumentForm mode="create" categories={categories} />;
}
