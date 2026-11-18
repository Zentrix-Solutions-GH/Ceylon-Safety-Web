"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { t } from "@/messages/en";
import type { DocKind } from "@/types/document";

const DOC_KINDS: { value: DocKind; label: string }[] = [
  { value: "checklist", label: t("documents.filter.type.checklist") },
  { value: "safety_sign", label: t("documents.filter.type.safety_sign") },
  { value: "toolbox_talk", label: t("documents.filter.type.toolbox_talk") },
];

interface Category {
  id: string;
  name: string;
}

interface DocumentSidebarProps {
  categories: Category[];
}

export function DocumentSidebar({ categories }: DocumentSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentCategory = searchParams.get("category") ?? "";
  const currentType = (searchParams.get("type") ?? "") as DocKind | "";
  const hasFilters = Boolean(currentCategory || currentType);

  function buildUrl(category: string, type: string): string {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    if (category) params.set("category", category); else params.delete("category");
    if (type) params.set("type", type); else params.delete("type");
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  function toggleCategory(id: string) {
    const next = currentCategory === id ? "" : id;
    router.replace(buildUrl(next, currentType));
  }

  function toggleType(value: DocKind) {
    const next = currentType === value ? "" : value;
    router.replace(buildUrl(currentCategory, next));
  }

  function clearFilters() {
    router.replace(pathname);
  }

  return (
    <div className="space-y-6">
      {/* Categories */}
      <div>
        <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-500">
          {t("documents.filter.category.label")}
        </h3>
        <ul className="space-y-1.5">
          <li>
            <button
              type="button"
              onClick={() => router.replace(buildUrl("", currentType))}
              className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm transition hover:bg-gray-50 ${
                !currentCategory ? "font-semibold text-red-600" : "text-gray-700"
              }`}
            >
              <span
                className={`inline-block h-2.5 w-2.5 shrink-0 rounded-sm border ${
                  !currentCategory ? "border-red-600 bg-red-600" : "border-gray-300"
                }`}
              />
              {t("documents.filter.category.all")}
            </button>
          </li>
          {categories.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => toggleCategory(c.id)}
                className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm transition hover:bg-gray-50 ${
                  currentCategory === c.id ? "font-semibold text-red-600" : "text-gray-700"
                }`}
              >
                <span
                  className={`inline-block h-2.5 w-2.5 shrink-0 rounded-sm border ${
                    currentCategory === c.id ? "border-red-600 bg-red-600" : "border-gray-300"
                  }`}
                />
                {c.name}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Document type */}
      <div>
        <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-500">
          {t("documents.filter.type.label")}
        </h3>
        <ul className="space-y-1.5">
          {DOC_KINDS.map((k) => (
            <li key={k.value}>
              <button
                type="button"
                onClick={() => toggleType(k.value)}
                className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm transition hover:bg-gray-50 ${
                  currentType === k.value ? "font-semibold text-red-600" : "text-gray-700"
                }`}
              >
                <span
                  className={`inline-block h-2.5 w-2.5 shrink-0 rounded-sm border ${
                    currentType === k.value ? "border-red-600 bg-red-600" : "border-gray-300"
                  }`}
                />
                {k.label}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Clear */}
      {hasFilters && (
        <button
          type="button"
          onClick={clearFilters}
          className="w-full rounded border border-gray-300 py-1.5 text-xs text-gray-500 hover:bg-gray-50"
        >
          {t("documents.filter.clear")}
        </button>
      )}
    </div>
  );
}

export default DocumentSidebar;
