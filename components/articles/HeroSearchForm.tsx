"use client";

import { type FormEvent } from "react";
import { t } from "@/messages/en";

export function HeroSearchForm() {
  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    const form = e.currentTarget;
    const q = (form.elements.namedItem("q") as HTMLInputElement).value.trim();
    if (!q) {
      e.preventDefault();
    }
  }

  return (
    <form
      action="/search"
      method="get"
      onSubmit={handleSubmit}
      className="flex overflow-hidden rounded-lg shadow-lg"
    >
      <input type="hidden" name="scope" value="articles" />
      <input
        type="search"
        name="q"
        placeholder={t("articles.filter.search.placeholder")}
        className="flex-1 bg-white px-5 py-3.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none"
      />
      <button
        type="submit"
        className="shrink-0 bg-red-600 px-6 py-3.5 text-sm font-bold text-white hover:bg-red-700 transition-colors"
      >
        {t("articles.filter.search.button")}
      </button>
    </form>
  );
}
