"use client";

import { useState, useEffect, useCallback } from "react";
import { publicConfig } from "@/lib/config.public";
import { listDocumentPickerItemsAction } from "@/lib/documents/actions/listDocumentPickerItemsAction";
import { t } from "@/messages/en";
import type { DocumentPickerItem } from "@/types/document";

interface PickedDocument {
  id: string;
  slug: string;
  title: string;
  coverImageKey: string | null;
  priceCents: number;
}

interface DocumentPickerModalProps {
  onPick: (doc: PickedDocument) => void;
  onClose: () => void;
}

export default function DocumentPickerModal({ onPick, onClose }: DocumentPickerModalProps) {
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<DocumentPickerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchItems = useCallback(async (q: string) => {
    setLoading(true);
    setError(false);
    const result = await listDocumentPickerItemsAction({ kind: "document", search: q || undefined });
    if (result.ok) {
      setItems(result.items);
    } else {
      setError(true);
      setItems([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchItems("");
  }, [fetchItems]);

  useEffect(() => {
    const timer = setTimeout(() => { fetchItems(search); }, 300);
    return () => clearTimeout(timer);
  }, [search, fetchItems]);

  return (
    <div role="dialog" aria-modal="true" aria-label={t("editor.doc_picker.title")}>
      <h2>{t("editor.doc_picker.title")}</h2>
      <input
        type="search"
        role="searchbox"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t("editor.doc_picker.search_placeholder")}
        aria-label={t("editor.doc_picker.search_placeholder")}
      />
      <button type="button" onClick={onClose} aria-label={t("editor.doc_picker.close")}>
        {t("editor.doc_picker.close")}
      </button>

      {loading ? (
        <p>{t("editor.doc_picker.loading")}</p>
      ) : error ? (
        <p role="alert">{t("editor.doc_picker.error")}</p>
      ) : items.length === 0 ? (
        <p>
          {t("editor.doc_picker.no_documents")}{" "}
          <a href="/admin/documents">{t("editor.doc_picker.no_documents_link")}</a>
        </p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                aria-label={item.title}
                onClick={() =>
                  onPick({
                    id: item.id,
                    slug: item.slug,
                    title: item.title,
                    coverImageKey: item.coverImageKey,
                    priceCents: item.priceCents,
                  })
                }
              >
                {item.coverImageKey && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`${publicConfig.mediaCdnUrl}/${item.coverImageKey}`}
                    alt={item.title}
                    className="picker-item__thumbnail"
                  />
                )}
                <span>{item.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
