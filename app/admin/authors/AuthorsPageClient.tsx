"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { t } from "@/messages/en";
import { setAuthorActive } from "@/lib/authors/actions/setAuthorActive";
import type { Author } from "@/types/author";

interface Props {
  initialAuthors: Author[];
}

export default function AuthorsPageClient({ initialAuthors }: Props) {
  const router = useRouter();
  const [authors, setAuthors] = useState(initialAuthors);
  const [toggleError, setToggleError] = useState<string | null>(null);

  async function handleToggle(author: Author) {
    setToggleError(null);
    const result = await setAuthorActive({
      id: author.id,
      active: !author.isActive,
      updatedAt: author.updatedAt,
    });

    if (!result.ok) {
      setToggleError(t("admin.authors.form_toggle_error"));
      return;
    }

    setAuthors((prev) =>
      prev.map((a) => (a.id === author.id ? result.author : a))
    );
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("admin.authors.page_title")}</h1>
        <Link
          href="/admin/authors/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          {t("admin.authors.add_button")}
        </Link>
      </div>

      {toggleError && (
        <p className="text-xs text-destructive">{toggleError}</p>
      )}

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left font-medium text-muted-foreground">
                {t("admin.authors.col_name")}
              </th>
              <th scope="col" className="px-4 py-3 text-left font-medium text-muted-foreground">
                {t("admin.authors.col_status")}
              </th>
              <th scope="col" className="px-4 py-3 text-left font-medium text-muted-foreground">
                {t("admin.authors.col_actions")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-background">
            {authors.map((author) => (
              <tr
                key={author.id}
                data-testid={`author-row-${author.id}`}
                className={`hover:bg-muted/30 transition-colors${!author.isActive ? " opacity-50" : ""}`}
              >
                <td className="px-4 py-3 font-medium">{author.name}</td>
                <td className="px-4 py-3">
                  {author.isActive ? (
                    <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      {t("admin.authors.badge_active")}
                    </span>
                  ) : (
                    <span
                      data-testid={`author-inactive-badge-${author.id}`}
                      className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600"
                    >
                      {t("admin.authors.badge_inactive")}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 flex items-center gap-3">
                  <Link
                    href={`/admin/authors/${author.id}/edit`}
                    className="text-primary underline-offset-4 hover:underline text-sm"
                  >
                    {t("admin.authors.edit_link")}
                  </Link>
                  <button
                    data-testid={`author-toggle-active-${author.id}`}
                    onClick={() => handleToggle(author)}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    {author.isActive
                      ? t("admin.authors.deactivate_button")
                      : t("admin.authors.reactivate_button")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
