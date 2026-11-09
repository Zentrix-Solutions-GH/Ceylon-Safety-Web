import "server-only";

import { z } from "zod";
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

const RawRowSchema = z.object({
  kind: z.string(),
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  short_text: z.string().nullable(),
  cover_image_key: z.string().nullable(),
  category_name: z.string().nullable(),
});

type RawRow = z.infer<typeof RawRowSchema>;

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

  const { data, error } = await supabase.rpc("search_all", {
    query: trimmed,
    scope: toDbScope(scope),
    lim: RESULT_LIMIT,
  });

  if (error) {
    // Log error code only — never log the query text (user data)
    console.error("[searchContent] db error:", error.code ?? "unknown");
    return { ok: false, code: "unknown" };
  }

  const parsed = z.array(RawRowSchema).safeParse(data ?? []);
  if (!parsed.success) {
    console.error("[searchContent] unexpected db shape:", parsed.error.issues[0]?.message);
    return { ok: false, code: "unknown" };
  }
  return { ok: true, data: parsed.data.map(mapRow) };
}
