"use client";

import { useState, useEffect, useCallback } from "react";
import { publicConfig } from "@/lib/config.public";
import { listPickerItemsAction } from "@/lib/videos/actions/listPickerItemsAction";
import { t } from "@/messages/en";
import type { PickerItem } from "@/types/video";

interface PickedVideo {
  id: string;
  title: string;
  thumbnailKey: string;
}

interface ItemPickerModalProps {
  onPick: (video: PickedVideo) => void;
  onClose: () => void;
}

export default function ItemPickerModal({ onPick, onClose }: ItemPickerModalProps) {
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<PickerItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async (q: string) => {
    setLoading(true);
    const result = await listPickerItemsAction({ kind: "video", search: q || undefined });
    if (result.ok) setItems(result.items);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchItems("");
  }, [fetchItems]);

  // Debounce search input — EC1
  useEffect(() => {
    const timer = setTimeout(() => { fetchItems(search); }, 300);
    return () => clearTimeout(timer);
  }, [search, fetchItems]);

  return (
    <div role="dialog" aria-modal="true" aria-label={t("editor.picker.title")}>
      <h2>{t("editor.picker.title")}</h2>
      <input
        type="search"
        role="searchbox"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t("editor.picker.search_placeholder")}
        aria-label={t("editor.picker.search_placeholder")}
      />
      <button type="button" onClick={onClose} aria-label={t("editor.picker.close")}>
        {t("editor.picker.close")}
      </button>

      {loading ? (
        <p>{t("editor.picker.loading")}</p>
      ) : items.length === 0 ? (
        <p>
          {t("editor.picker.no_videos")}{" "}
          <a href="/admin/videos">{t("editor.picker.no_videos_link")}</a>
        </p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onPick({ id: item.id, title: item.title, thumbnailKey: item.thumbnailKey })}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${publicConfig.mediaCdnUrl}/${item.thumbnailKey}`}
                  alt={item.title}
                  className="picker-item__thumbnail"
                />
                <span>{item.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
