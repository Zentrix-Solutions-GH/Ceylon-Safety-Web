import "server-only";
import { z } from "zod";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type {
  ArticleCard,
  ArticleListInput,
  ArticleListResponse,
  ArticleListResult,
  ArticleCursor,
} from "@/types/article";

const PAGE_SIZE = 12;

// Asia/Colombo is UTC+5:30. Midnight Colombo = 18:30 UTC previous day.
function colomboMidnightUtc(daysAgo: number): string {
  const now = new Date();
  // Get today's date in Colombo (UTC+5:30)
  const colomboOffsetMs = 5.5 * 60 * 60 * 1000;
  const colomboNow = new Date(now.getTime() + colomboOffsetMs);
  // Start of Colombo today (midnight)
  const colomboToday = new Date(
    Date.UTC(
      colomboNow.getUTCFullYear(),
      colomboNow.getUTCMonth(),
      colomboNow.getUTCDate(),
      0,
      0,
      0,
      0
    )
  );
  // Go back N days in Colombo calendar
  colomboToday.setUTCDate(colomboToday.getUTCDate() - daysAgo);
  // Convert back to UTC (subtract the Colombo offset)
  const utc = new Date(colomboToday.getTime() - colomboOffsetMs);
  return utc.toISOString();
}

const CursorSchema = z.object({
  publishedAt: z.string().datetime(),
  id: z.string().uuid(),
});

export async function listArticles(input: ArticleListInput): Promise<ArticleListResponse> {
  const { range = "newest", category, cursor } = input;

  // Validate cursor if provided
  if (cursor !== undefined) {
    const parsed = CursorSchema.safeParse(cursor);
    if (!parsed.success) {
      return { ok: false, code: "validation_failed", reason: "Invalid cursor" };
    }
  }

  const supabase = createSupabaseServiceRoleClient();
  const now = new Date().toISOString();

  let query = supabase
    .from("articles")
    .select(
      `id, slug, title, excerpt,
       cover_image_key, cover_image_alt, published_at, like_count, comment_count,
       categories!inner(id, name, slug),
       authors!inner(name)`,
      { count: undefined }
    )
    .eq("status", "published")
    .lte("published_at", now)
    .is("deleted_at", null);

  if (range === "week") {
    query = query.gte("published_at", colomboMidnightUtc(7));
  } else if (range === "month") {
    query = query.gte("published_at", colomboMidnightUtc(30));
  }

  if (category) {
    query = query.eq("categories.slug", category);
  }

  if (cursor) {
    // Keyset: published_at < cursor.publishedAt OR (published_at = cursor.publishedAt AND id > cursor.id)
    query = query.or(
      `published_at.lt.${cursor.publishedAt},and(published_at.eq.${cursor.publishedAt},id.gt.${cursor.id})`
    );
  }

  const { data, error } = await query
    .order("published_at", { ascending: false })
    .order("id", { ascending: true })
    .limit(PAGE_SIZE + 1);

  if (error) {
    console.error("[listArticles] db error:", error.code ?? "unknown");
    return { ok: true, data: { items: [], next: null } };
  }
  if (!data) {
    return { ok: true, data: { items: [], next: null } };
  }

  const hasMore = data.length > PAGE_SIZE;
  const rows = hasMore ? data.slice(0, PAGE_SIZE) : data;

  const items: ArticleCard[] = rows.map((r) => ({
    id: r.id as string,
    slug: r.slug as string,
    title: r.title as string,
    excerpt: (r.excerpt as string | null) ?? null,
    coverImageKey: (r.cover_image_key as string | null) ?? null,
    coverImageAlt: (r.cover_image_alt as string | null) ?? null,
    category: r.categories as unknown as { id: string; name: string; slug: string },
    authorName: (r.authors as unknown as { name: string }).name,
    publishedAt: r.published_at as string,
    likeCount: (r.like_count as number) ?? 0,
    commentCount: (r.comment_count as number) ?? 0,
  }));

  let next: ArticleCursor | null = null;
  if (hasMore) {
    const last = items[items.length - 1];
    next = { publishedAt: last.publishedAt, id: last.id };
  }

  const result: ArticleListResult = { items, next };
  return { ok: true, data: result };
}
