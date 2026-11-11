import { t } from "@/messages/en";
import AuthorForm from "@/components/admin/AuthorForm";

export default function NewAuthorPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("admin.authors.new_page_title")}</h1>
      <AuthorForm />
    </div>
  );
}
