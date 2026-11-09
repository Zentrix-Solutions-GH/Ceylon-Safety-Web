import "server-only";

import { createSupabaseAnonClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/ratelimit/index";
import type { SearchScope, SearchResponse, SearchResultItem } from "@/types/api";

const QUERY_MAX_LEN = 100;
const RESULT_LIMIT = 50;
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW = 60;

function toDbScope(scope: SearchScope): "all" | "articles" | "documents" {
  return scope === "home" ? "all" : scope;
}

type RawRow = {
  kind: string;
  id: string;
  slug: string;
  title: string;
  short_text: string | null;
  cover_image_key: string | null;
  category_name: string | null;
};

function mapRow(row: RawRow): SearchResultItem {
  return {
    kind: row.kind as "article" | "document",
    id: row.id,
    slug: row.slug,
    title: row.title,
    shortText: row.short_text ?? "",
    coverImageKey: row.cover_image_key ?? null,
    categoryName: row.category_name ?? null,
  };
}

export async function searchContent(
  { scope, query }: { scope: SearchScope; query: string },
  callerIp: string
): Promise<SearchResponse> {
  if (scope !== "home" && scope !== "articles" && scope !== "documents") {
    return { ok: false, code: "validation_failed", field: "scope" };
  }

  const trimmed = query.trim();

  if (trimmed.length === 0) {
    return { ok: true, data: [] };
  }

  if (trimmed.length > QUERY_MAX_LEN) {
    return { ok: false, code: "validation_failed", field: "query" };
  }

  const rl = await checkRateLimit({
    limitName: "search",
    key: callerIp,
    maxCount: RATE_LIMIT_MAX,
    windowSeconds: RATE_LIMIT_WINDOW,
    mode: "open",
  });

  if (!rl.ok) {
    return { ok: false, code: "rate_limited" };
  }

  const supabase = createSupabaseAnonClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("search_all", {
    query: trimmed,
    scope: toDbScope(scope),
    lim: RESULT_LIMIT,
  });

  if (error) {
    // Log error code only — never log the query text (user data)
    console.error("[searchContent] db error:", error.code ?? "unknown");
    return { ok: false, code: "unknown" };
  }

  const rows = ((data as unknown) as RawRow[] | null) ?? [];
  return { ok: true, data: rows.map(mapRow) };
}
