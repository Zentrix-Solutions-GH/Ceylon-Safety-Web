import "server-only";
import { unstable_cache } from "next/cache";
import { createSupabaseAnonClient } from "@/lib/supabase/server";
import { ANNOUNCEMENT_TAG } from "@/lib/cache/tags";

export interface AnnouncementBanner {
  enabled: boolean;
  text: string;
  linkLabel: string;
  linkHref: string;
}

function isSafeHref(href: string): boolean {
  return (href.startsWith("/") && !href.startsWith("//")) || href.startsWith("https://");
}

const FALLBACK: AnnouncementBanner = {
  enabled: false,
  text: "",
  linkLabel: "",
  linkHref: "/",
};

const KEYS = ["announcement_enabled", "announcement_text", "announcement_link_label", "announcement_link_href"] as const;

const fetchAnnouncement = unstable_cache(
  async (): Promise<AnnouncementBanner> => {
    try {
      const supabase = createSupabaseAnonClient();
      const { data, error } = await supabase
        .from("site_settings")
        .select("key, value")
        .in("key", [...KEYS]);

      if (error || !data || data.length === 0) return FALLBACK;

      function str(key: string): string | null {
        const row = data!.find((r) => r.key === key);
        if (!row || row.value === null || row.value === undefined) return null;
        // value is stored as jsonb — a JSON string is returned as a JS string already
        return typeof row.value === "string" ? row.value : String(row.value);
      }

      function bool(key: string, fallback: boolean): boolean {
        const row = data!.find((r) => r.key === key);
        if (!row || row.value === null) return fallback;
        return row.value === true || row.value === "true";
      }

      return {
        enabled: bool("announcement_enabled", FALLBACK.enabled),
        text: str("announcement_text") ?? FALLBACK.text,
        linkLabel: str("announcement_link_label") ?? FALLBACK.linkLabel,
        linkHref: (() => {
          const h = str("announcement_link_href") ?? FALLBACK.linkHref;
          return isSafeHref(h) ? h : FALLBACK.linkHref;
        })(),
      };
    } catch {
      return FALLBACK;
    }
  },
  [ANNOUNCEMENT_TAG],
  { revalidate: 300, tags: [ANNOUNCEMENT_TAG] }
);

export async function getAnnouncementBanner(): Promise<AnnouncementBanner> {
  return fetchAnnouncement();
}
