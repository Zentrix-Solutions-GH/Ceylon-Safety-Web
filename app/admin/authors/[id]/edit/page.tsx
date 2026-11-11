import { redirect } from "next/navigation";
import { listAuthors } from "@/lib/authors/actions/listAuthors";
import { t } from "@/messages/en";
import AuthorForm from "@/components/admin/AuthorForm";

export default async function EditAuthorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // TODO(backend): replace with getAuthor(id) once available — full-table fetch to find one row
  const result = await listAuthors({ includeInactive: true });
  if (!result.ok) {
    if (result.code === "not_allowed") redirect("/admin");
    redirect("/admin/authors");
  }

  const author = result.authors.find((a) => a.id === id);
  if (!author) redirect("/admin/authors");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("admin.authors.edit_page_title")}</h1>
      <AuthorForm author={author} />
    </div>
  );
}
