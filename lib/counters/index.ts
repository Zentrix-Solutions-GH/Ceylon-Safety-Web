import "server-only";
import { unstable_cache } from "next/cache";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { COUNTERS_TAG } from "@/lib/cache/tags";
import type { Counters } from "@/types/api";

const DEFAULT_MIN = 10;
const DEFAULT_LADDER = [10, 50, 100, 1000];

export type CounterSettings = { min: number; ladder: number[] } | null;

export function roundCounter(raw: number, settings: CounterSettings = null): number | null {
  const min = settings?.min ?? DEFAULT_MIN;
  const ladder = settings?.ladder ?? DEFAULT_LADDER;

  if (raw < min) return null;

  // Find largest multiple of 1000 for values beyond the ladder
  const maxLadder = Math.max(...ladder);

  if (raw >= maxLadder) {
    // Round down to the nearest multiple of the last ladder step (1000)
    const step = ladder[ladder.length - 1];
    return Math.floor(raw / step) * step;
  }

  // Find largest ladder step that is <= raw
  let result = min;
  for (const step of ladder) {
    if (step <= raw) result = step;
    else break;
  }
  return result;
}

const fetchCounters = unstable_cache(
  async (): Promise<Counters> => {
    const supabase = createSupabaseServiceRoleClient();
    const { data, error } = await supabase
      .from("home_counters")
      .select("published_articles, published_documents, registered_users, total_downloads")
      .single();

    if (error || !data) {
      return { articles: null, documents: null, users: null, downloads: null };
    }

    // Read rounding settings from site_settings
    const { data: settingsRows } = await supabase
      .from("site_settings")
      .select("key, value")
      .in("key", ["counters_min_visible", "counters_rounding"]);

    let settings: CounterSettings = null;
    if (settingsRows && settingsRows.length > 0) {
      try {
        const minRow = settingsRows.find((r) => r.key === "counters_min_visible");
        const ladderRow = settingsRows.find((r) => r.key === "counters_rounding");
        const minVal = minRow ? String(minRow.value ?? "") : "";
        const ladderVal = ladderRow ? String(ladderRow.value ?? "") : "";
        const min = minVal ? parseInt(minVal, 10) : DEFAULT_MIN;
        const ladder = ladderVal ? JSON.parse(ladderVal) : DEFAULT_LADDER;
        if (!isNaN(min) && Array.isArray(ladder) && ladder.every((v: unknown) => typeof v === "number")) {
          settings = { min, ladder };
        }
      } catch {
        // malformed settings — use defaults (EC8)
      }
    }

    return {
      articles: roundCounter(data.published_articles ?? 0, settings),
      documents: roundCounter(data.published_documents ?? 0, settings),
      users: roundCounter(data.registered_users ?? 0, settings),
      downloads: roundCounter(data.total_downloads ?? 0, settings),
    };
  },
  ["counters"],
  { revalidate: 3600, tags: [COUNTERS_TAG] }
);

export async function getCounters(): Promise<Counters> {
  return fetchCounters();
}
