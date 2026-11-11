"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { t } from "@/messages/en";
import { saveAuthor } from "@/lib/authors/actions/saveAuthor";
import type { Author } from "@/types/author";

interface Props {
  author?: Author;
}

export default function AuthorForm({ author }: Props) {
  const router = useRouter();
  const [name, setName] = useState(author?.name ?? "");
  const [bio, setBio] = useState(author?.bio ?? "");
  const [nameError, setNameError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setNameError(null);
    setSaveError(null);

    if (!name.trim()) {
      setNameError(t("admin.authors.form_name_required"));
      return;
    }

    setSaving(true);
    try {
      const result = await saveAuthor({
        id: author?.id,
        name: name.trim(),
        bio: bio.trim() || null,
        updatedAt: author?.updatedAt,
      });
      if (!result.ok) {
        setSaveError(t("admin.authors.form_save_error"));
        return;
      }
      router.push("/admin/authors");
    } catch {
      setSaveError(t("admin.authors.form_save_error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      <div>
        <label htmlFor="author-name" className="block text-sm font-medium mb-1">
          {t("admin.authors.form_name_label")}
        </label>
        <input
          id="author-name"
          data-testid="author-name-input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("admin.authors.form_name_placeholder")}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        {nameError && (
          <p data-testid="author-name-error" className="mt-1 text-xs text-destructive">
            {nameError}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="author-bio" className="block text-sm font-medium mb-1">
          {t("admin.authors.form_bio_label")}
        </label>
        <textarea
          id="author-bio"
          data-testid="author-bio-input"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder={t("admin.authors.form_bio_placeholder")}
          rows={4}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </div>

      {saveError && (
        <p className="text-xs text-destructive">{saveError}</p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {t("admin.authors.form_save_button")}
      </button>
    </form>
  );
}
