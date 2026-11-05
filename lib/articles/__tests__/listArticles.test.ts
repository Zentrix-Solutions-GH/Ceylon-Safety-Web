// S-049: listArticles — AC1, EC5, EC6

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({
  serverConfig: { supabaseServiceRoleKey: "srk" },
  publicConfig: { supabaseUrl: "https://test.supabase.co", supabaseAnonKey: "anon" },
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: vi.fn(),
}));
vi.mock("next/cache", () => ({
  unstable_cache: (fn: unknown) => fn,
  unstable_cacheTag: vi.fn(),
  unstable_cacheLife: vi.fn(),
  revalidateTag: vi.fn(),
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
}));

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { listArticles } from "@/lib/articles/listArticles";

const CAT = { id: "cat-1", name: "Fire Safety", slug: "fire-safety" };

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "art-1",
    slug: "test-article",
    title: "Test Article",
    excerpt: "An excerpt",
    cover_image_key: "imgs/cover.jpg",
    cover_image_alt: "Cover",
    published_at: "2026-10-01T08:00:00+05:30",
    like_count: 5,
    comment_count: 2,
    categories: CAT,
    authors: { name: "John" },
    ...overrides,
  };
}

function makeSupabase(rows: unknown[], error?: { message: string }) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: rows, error: error ?? null }),
  };
  (createSupabaseServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── AC1: basic list, range, category, cursor ────────────────────────────────

describe("listArticles — AC1", () => {
  it("returns items for range=newest (no date limit)", async () => {
    const sb = makeSupabase([makeRow()]);
    const result = await listArticles({ range: "newest" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items).toHaveLength(1);
    expect(result.data.items[0].slug).toBe("test-article");
    // gte should NOT have been called for 'newest'
    expect(sb.gte).not.toHaveBeenCalled();
  });

  it("returns items for range=week (applies gte filter)", async () => {
    const sb = makeSupabase([makeRow()]);
    const result = await listArticles({ range: "week" });
    expect(result.ok).toBe(true);
    // gte must be called with published_at
    expect(sb.gte).toHaveBeenCalledWith("published_at", expect.any(String));
  });

  it("returns items for range=month (applies gte filter)", async () => {
    const sb = makeSupabase([makeRow()]);
    const result = await listArticles({ range: "month" });
    expect(result.ok).toBe(true);
    expect(sb.gte).toHaveBeenCalledWith("published_at", expect.any(String));
  });

  it("filters by category slug when provided", async () => {
    const sb = makeSupabase([makeRow()]);
    await listArticles({ category: "fire-safety" });
    expect(sb.eq).toHaveBeenCalledWith("categories.slug", "fire-safety");
  });

  it("returns next cursor when page is full", async () => {
    // listArticles fetches PAGE_SIZE+1 (13) to detect more pages
    const rows = Array.from({ length: 13 }, (_, i) =>
      makeRow({ id: `art-${i}`, published_at: `2026-09-${String(i + 1).padStart(2, "0")}T08:00:00+05:30` })
    );
    makeSupabase(rows);
    const result = await listArticles({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.next).not.toBeNull();
  });

  it("returns null next when fewer items than page size", async () => {
    makeSupabase([makeRow()]);
    const result = await listArticles({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.next).toBeNull();
  });
});

// ─── EC5: cursor validation ───────────────────────────────────────────────────

describe("listArticles — EC5 cursor validation", () => {
  it("rejects a cursor with a non-date publishedAt", async () => {
    makeSupabase([]);
    const result = await listArticles({ cursor: { publishedAt: "not-a-date", id: "art-1" } });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("validation_failed");
  });

  it("rejects a cursor with an empty id", async () => {
    makeSupabase([]);
    const result = await listArticles({ cursor: { publishedAt: "2026-10-01T08:00:00Z", id: "" } });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("validation_failed");
  });

  it("accepts a valid cursor", async () => {
    makeSupabase([]);
    const result = await listArticles({ cursor: { publishedAt: "2026-10-01T08:00:00Z", id: "00000000-0000-4000-8000-000000000001" } });
    expect(result.ok).toBe(true);
  });
});

// ─── EC6: week/month boundaries use Colombo time ─────────────────────────────

describe("listArticles — EC6 Colombo calendar", () => {
  it("week cutoff is 7 days ago at Colombo midnight", async () => {
    const sb = makeSupabase([]);
    await listArticles({ range: "week" });
    const [, cutoff] = sb.gte.mock.calls[0] as [string, string];
    // The cutoff should be a valid ISO date and should NOT be the UTC midnight
    expect(new Date(cutoff).toISOString()).toBe(cutoff);
    // Asia/Colombo is UTC+5:30, so midnight Colombo = 18:30 UTC previous day
    expect(cutoff).toMatch(/T18:30:00\.000Z$/);
  });

  it("month cutoff is 30 days ago at Colombo midnight", async () => {
    const sb = makeSupabase([]);
    await listArticles({ range: "month" });
    const [, cutoff] = sb.gte.mock.calls[0] as [string, string];
    expect(cutoff).toMatch(/T18:30:00\.000Z$/);
  });

  it("week cutoff date is exactly correct for a known Colombo time", async () => {
    // Fix the clock to 2026-11-05T10:00:00Z (= 15:30 Colombo on 2026-11-05)
    // Colombo midnight 7 days ago = 2026-10-29T00:00:00+05:30 = 2026-10-28T18:30:00Z
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-05T10:00:00.000Z"));
    try {
      const sb = makeSupabase([]);
      await listArticles({ range: "week" });
      const [, cutoff] = sb.gte.mock.calls[0] as [string, string];
      expect(cutoff).toBe("2026-10-28T18:30:00.000Z");
    } finally {
      vi.useRealTimers();
    }
  });
});

// ─── AC2: all ArticleCard fields present ─────────────────────────────────────

describe("listArticles — AC2 ArticleCard fields", () => {
  it("returns all required fields on each card", async () => {
    makeSupabase([makeRow()]);
    const result = await listArticles({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const card = result.data.items[0];
    expect(card.id).toBe("art-1");
    expect(card.slug).toBe("test-article");
    expect(card.title).toBe("Test Article");
    expect(card.excerpt).toBe("An excerpt");
    expect(card.coverImageKey).toBe("imgs/cover.jpg");
    expect(card.coverImageAlt).toBe("Cover");
    expect(card.category).toMatchObject({ id: "cat-1", name: "Fire Safety", slug: "fire-safety" });
    expect(card.authorName).toBe("John");
    expect(card.publishedAt).toBe("2026-10-01T08:00:00+05:30");
    expect(card.likeCount).toBe(5);
    expect(card.commentCount).toBe(2);
  });
});

// ─── EC2: deactivated author — article still returns author name ──────────────

describe("listArticles — EC2 deactivated author", () => {
  it("still returns the author name when the author is inactive", async () => {
    // The JOIN reads name from the authors table regardless of author status.
    // If the name comes back (the row exists), it is mapped correctly.
    makeSupabase([makeRow({ authors: { name: "Inactive Author" } })]);
    const result = await listArticles({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items[0].authorName).toBe("Inactive Author");
  });
});
