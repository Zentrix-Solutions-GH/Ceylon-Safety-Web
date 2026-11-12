"use client";

import Image from "next/image";
import Link from "next/link";
import { t } from "@/messages/en";
import { publicConfig } from "@/lib/config.public";
import type { SearchResultItem } from "@/types/api";
import type { SearchStatus } from "@/hooks/useSearch";

type Props = {
  status: SearchStatus;
  items: SearchResultItem[];
};

function kindLabel(kind: SearchResultItem["kind"]) {
  return kind === "article" ? t("search.results.kind_article") : t("search.results.kind_document");
}

function itemHref(item: SearchResultItem) {
  if (item.kind === "article") return `/articles/${item.slug}`;
  return `/documents?document=${item.slug}`;
}

export default function SearchResults({ status, items }: Props) {
  if (status === "loading") {
    return (
      <div role="status" aria-label={t("search.results.loading")}>
        <div className="space-y-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-20 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  if (status === "rate_limited") {
    return <p className="text-sm text-amber-700">{t("search.results.rate_limited")}</p>;
  }

  if (status === "error") {
    return <p className="text-sm text-red-600">{t("search.results.error")}</p>;
  }

  if (status === "idle") return null;

  if (items.length === 0) {
    return <p className="text-sm text-gray-500">{t("search.results.none")}</p>;
  }

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold text-gray-900">{t("search.results.heading")}</h2>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={itemHref(item)}
              className="flex gap-3 rounded-lg border border-gray-200 p-4 hover:border-primary hover:bg-gray-50 transition-colors"
            >
              {item.coverImageKey && (
                <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded">
                  <Image
                    src={`${publicConfig.mediaCdnUrl}/${item.coverImageKey.replace(/^\/+/, "")}`}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                </div>
              )}
              <div className="min-w-0">
                <span className="mb-1 inline-block text-xs font-semibold uppercase tracking-wider text-primary">
                  {kindLabel(item.kind)}
                </span>
                <p className="font-semibold text-gray-900">{item.title}</p>
                {item.shortText && (
                  <p className="mt-1 text-sm text-gray-600 line-clamp-2">{item.shortText}</p>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
