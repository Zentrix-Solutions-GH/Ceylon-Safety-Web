import "server-only";
import { unstable_cache } from "next/cache";
import { createSupabaseAnonClient } from "@/lib/supabase/server";
import { ADS_SETTINGS_TAG } from "@/lib/cache/tags";

export interface AdsSettings {
  enabled: boolean;
  clientId: string;
  slotSidebarLeft: string;
  slotSidebarRight: string;
}

const FALLBACK: AdsSettings = {
  enabled: false,
  clientId: "",
  slotSidebarLeft: "",
  slotSidebarRight: "",
};

const KEYS = [
  "ads_enabled",
  "adsense_client_id",
  "adsense_slot_sidebar_left",
  "adsense_slot_sidebar_right",
] as const;

const fetchAdsSettings = unstable_cache(
  async (): Promise<AdsSettings> => {
    try {
      const supabase = createSupabaseAnonClient();
      const { data, error } = await supabase
        .from("site_settings")
        .select("key, value")
        .in("key", [...KEYS]);

      if (error || !data || data.length === 0) return FALLBACK;

      function str(key: string): string {
        const row = data!.find((r) => r.key === key);
        if (!row || row.value === null) return "";
        return typeof row.value === "string" ? row.value : String(row.value);
      }

      function bool(key: string): boolean {
        const row = data!.find((r) => r.key === key);
        if (!row || row.value === null) return false;
        return row.value === true || row.value === "true";
      }

      return {
        enabled: bool("ads_enabled"),
        clientId: str("adsense_client_id"),
        slotSidebarLeft: str("adsense_slot_sidebar_left"),
        slotSidebarRight: str("adsense_slot_sidebar_right"),
      };
    } catch {
      return FALLBACK;
    }
  },
  [ADS_SETTINGS_TAG],
  { revalidate: 300, tags: [ADS_SETTINGS_TAG] }
);

export async function getAdsSettings(): Promise<AdsSettings> {
  return fetchAdsSettings();
}
