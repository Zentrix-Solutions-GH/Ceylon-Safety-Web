import { redirect } from "next/navigation";
import { listAuthors } from "@/lib/authors/actions/listAuthors";
import AuthorsPageClient from "./AuthorsPageClient";

export default async function AdminAuthorsPage() {
  const result = await listAuthors({ includeInactive: true });

  if (!result.ok) {
    if (result.code === "not_allowed") redirect("/admin");
    redirect("/admin/authors");
  }

  return <AuthorsPageClient initialAuthors={result.authors} />;
}
