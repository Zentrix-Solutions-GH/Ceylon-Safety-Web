"use client";

import { Search } from "lucide-react";
import { t } from "@/messages/en";

export function HeroSearchForm() {
  return (
    <form
      action="/search"
      method="get"
      onSubmit={(e) => e.preventDefault()}
      className="flex overflow-hidden rounded-full border border-gray-200 bg-white shadow-2xl"
    >
      <div className="flex flex-1 items-center gap-2 px-5 py-3.5">
        <Search className="h-4 w-4 shrink-0 text-gray-400" />
        <input
          type="search"
          name="q"
          placeholder={t("home.hero.search_placeholder")}
          className="w-full bg-transparent text-sm text-gray-700 placeholder-gray-400 focus:outline-none"
        />
      </div>
      <div className="border-l border-gray-200">
        <select name="category" className="h-full border-0 bg-transparent px-4 text-sm text-gray-600 focus:outline-none pr-8">
          <option value="">{t("home.hero.search_category_all")}</option>
          <option value="fire">{t("home.hero.search_category_fire")}</option>
          <option value="construction">{t("home.hero.search_category_construction")}</option>
          <option value="chemical">{t("home.hero.search_category_chemical")}</option>
          <option value="electrical">{t("home.hero.search_category_electrical")}</option>
          <option value="ergonomics">{t("home.hero.search_category_ergonomics")}</option>
        </select>
      </div>
      <button
        type="submit"
        className="whitespace-nowrap rounded-r-full bg-primary px-7 py-3.5 text-sm font-bold text-primary-foreground hover:bg-primary-dark transition-colors tracking-wide"
      >
        {t("home.hero.search_button")}
      </button>
    </form>
  );
}
