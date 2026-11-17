"use client";

import { t } from "@/messages/en";
import type { DocumentLanguage } from "@/types/document";

const LANGUAGE_LABELS: Record<DocumentLanguage, string> = {
  en: "language_picker.en",
  si: "language_picker.si",
  ta: "language_picker.ta",
} as const;

interface Props {
  availableLanguages: DocumentLanguage[];
  selected: DocumentLanguage | null;
  onChange: (lang: DocumentLanguage) => void;
  disabled?: boolean;
}

export default function LanguagePicker({
  availableLanguages,
  selected,
  onChange,
  disabled = false,
}: Props) {
  return (
    <div role="group" aria-label={t("language_picker.label")}>
      <div className="flex flex-wrap gap-2">
        {availableLanguages.map((lang) => (
          <button
            key={lang}
            type="button"
            role="button"
            aria-pressed={selected === lang}
            disabled={disabled}
            onClick={() => onChange(lang)}
            className={[
              "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
              selected === lang
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-foreground hover:bg-muted",
              disabled ? "cursor-not-allowed opacity-50" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {t(LANGUAGE_LABELS[lang] as Parameters<typeof t>[0])}
          </button>
        ))}
      </div>
    </div>
  );
}
