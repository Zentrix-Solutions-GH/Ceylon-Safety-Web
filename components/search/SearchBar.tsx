"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { t } from "@/messages/en";
import type { SearchScope } from "@/types/api";

type Props = {
  scope: SearchScope;
  className?: string;
};

export default function SearchBar({ scope, className }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const raw = inputRef.current?.value ?? "";
    const q = raw.trim();
    if (!q) return;
    const params = new URLSearchParams({ scope, q });
    router.push(`/search?${params.toString()}`);
  }

  return (
    <form
      role="search"
      onSubmit={handleSubmit}
      className={className}
    >
      <label htmlFor="search-input" className="sr-only">
        {t("search.bar.label")}
      </label>
      <input
        ref={inputRef}
        id="search-input"
        type="search"
        name="q"
        placeholder={t("search.bar.placeholder")}
        maxLength={100}
        className="flex-1 bg-transparent px-4 py-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none"
      />
      <button
        type="submit"
        className="px-6 py-3 text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary-dark transition-colors"
      >
        {t("search.bar.button")}
      </button>
    </form>
  );
}
