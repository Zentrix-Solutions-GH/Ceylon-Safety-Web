// Slug generation and clash-safe lookup for articles.
// Design source: content system design section 4.3.

import { nanoid } from "nanoid";

// Reserved slugs — matches the Next.js App Router route names in this project.
// Keep in sync with actual routes in app/.
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  "admin",
  "api",
  "search",
  "new",
  "edit",
  "preview",
  "sign-in",
  "sign-up",
  "sign-out",
  "account",
  "articles",
  "documents",
  "courses",
  "videos",
  "contact",
  "about",
  "jobs",
  "privacy",
  "terms",
  "sitemap",
  "feed",
  "auth",
]);

const MAX_SLUG_LENGTH = 80;

/**
 * Generate a slug from a title:
 * - Lowercase, accents removed, non-alphanumeric → hyphen
 * - At most 80 characters
 * - Falls back to a short random id if nothing usable remains (e.g. Sinhala-only)
 */
export function generateSlug(title: string): string {
  // Normalize: decompose accented chars, then remove combining marks
  const normalized = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // non-alphanumeric → hyphen
    .replace(/^-+|-+$/g, "")     // strip leading/trailing hyphens
    .replace(/-{2,}/g, "-")      // collapse multiple hyphens
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/, "");         // strip trailing hyphen after truncation

  if (!normalized) {
    // Nothing usable (e.g. Sinhala-only title) — fall back to random id
    return nanoid(10).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10) || nanoid(8);
  }

  return normalized;
}

/**
 * Find a clash-free slug by appending an incrementing number until unique.
 * Checks the articles table scoped to the given locale.
 *
 * @param baseSlug - The desired slug (already generated from the title or supplied by admin)
 * @param articleId - Exclude this article's own slug from the clash check (for updates)
 * @param locale - The article locale (default 'en')
 * @param supabase - Supabase service-role client
 */
export async function clashSafeSlug(
  baseSlug: string,
  articleId: string | null,
  locale: string,
  supabase: {
    from: (table: string) => {
      select: (col: string) => {
        eq: (col: string, val: string) => {
          eq: (col: string, val: string) => {
            neq?: (col: string, val: string) => { data: unknown[]; error: unknown } | PromiseLike<{ data: unknown[]; error: unknown }>;
            data: unknown[];
            error: unknown;
          } | PromiseLike<{ data: unknown[]; error: unknown }>;
        };
      };
    };
  }
): Promise<string> {
  let candidate = baseSlug;
  let attempt = 0;

  while (true) {
    const query = supabase
      .from("articles")
      .select("id")
      .eq("locale", locale)
      .eq("slug", candidate);

    // Exclude the article being updated from the clash check
    // The Supabase client builder is chainable but we need to handle the shape
    const result = await (query as unknown as Promise<{ data: unknown[]; error: unknown }>);

    const rows = (result.data ?? []) as { id: string }[];
    const clash = rows.some(r => r.id !== articleId);

    if (!clash) return candidate;

    attempt++;
    candidate = `${baseSlug}-${attempt}`;
  }
}
