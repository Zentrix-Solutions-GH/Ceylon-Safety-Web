import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({
  serverConfig: { supabaseServiceRoleKey: "srk", feedRateLimitPerMinute: 60, countersRateLimitPerMinute: 60 },
  publicConfig: { supabaseUrl: "https://test.supabase.co", supabaseAnonKey: "anon" },
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: vi.fn(),
}));
vi.mock("@/lib/ratelimit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));

import { parseCursor, encodeCursor, PAGE_SIZE, getFeed } from "../query";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

const mockCreate = vi.mocked(createSupabaseServiceRoleClient);

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    kind: "article",
    id: "550e8400-e29b-41d4-a716-446655440000",
    title: "Article",
    summary: null,
    image: null,
    category_id: "cat-1",
    published_at: "2026-01-15T10:00:00.000Z",
    like_count: 0,
    comment_count: 0,
    status: "published",
    deleted_at: null,
    locale: "en",
    ...overrides,
  };
}

function makeQueryChain(resolvedData: unknown[]) {
  // Thenable chain: every builder method returns `this`; awaiting resolves to { data, error }.
  const p = Promise.resolve({ data: resolvedData, error: null });
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    then: p.then.bind(p),
    catch: p.catch.bind(p),
    finally: p.finally.bind(p),
  };
  return chain;
}

function makeSupabaseMock(feedRows: unknown[]) {
  const feedChain = makeQueryChain(feedRows);
  const articlesChain = makeQueryChain([]);
  mockCreate.mockReturnValue({
    from: vi.fn((table: string) => (table === "articles" ? articlesChain : feedChain)),
  } as never);
  return { feedChain };
}

describe("PAGE_SIZE — AC1", () => {
  it("is 12", () => {
    expect(PAGE_SIZE).toBe(12);
  });
});

describe("parseCursor — AC2", () => {
  const validTime = "2026-01-15T10:00:00.000Z";
  const validId = "550e8400-e29b-41d4-a716-446655440000";

  it("returns ok for valid cursor", () => {
    const encoded = encodeCursor(validTime, validId);
    const result = parseCursor(encoded);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.publishedAt).toBe(validTime);
      expect(result.id).toBe(validId);
    }
  });

  it("returns validation_failed for empty string", () => {
    const result = parseCursor("");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("validation_failed");
  });

  it("returns validation_failed for plain text", () => {
    const result = parseCursor("not-a-cursor");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("validation_failed");
  });

  it("returns validation_failed for invalid timestamp", () => {
    const encoded = encodeCursor("not-a-date", validId);
    const result = parseCursor(encoded);
    expect(result.ok).toBe(false);
  });

  it("returns validation_failed for invalid UUID", () => {
    const encoded = encodeCursor(validTime, "not-a-uuid");
    const result = parseCursor(encoded);
    expect(result.ok).toBe(false);
  });

  it("returns validation_failed for undefined", () => {
    const result = parseCursor(undefined);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("validation_failed");
  });
});

describe("encodeCursor / parseCursor round-trip — EC3", () => {
  it("round-trips correctly", () => {
    const t = "2026-06-01T12:00:00.000Z";
    const id = "123e4567-e89b-12d3-a456-426614174000";
    const encoded = encodeCursor(t, id);
    const result = parseCursor(encoded);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.publishedAt).toBe(t);
      expect(result.id).toBe(id);
    }
  });
});

describe("getFeed empty feed — EC1", () => {
  it("0 rows → {items: [], nextCursor: null}", async () => {
    makeSupabaseMock([]);
    const result = await getFeed();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.page.items).toEqual([]);
    expect(result.page.nextCursor).toBeNull();
  });
});

describe("getFeed paging boundary — EC2", () => {
  it("13 rows → nextCursor is non-null", async () => {
    const rows = Array.from({ length: 13 }, (_, i) =>
      makeRow({ id: `550e8400-e29b-41d4-a716-${String(i).padStart(12, "0")}`, published_at: `2026-01-${String(15 - i).padStart(2, "0")}T10:00:00.000Z` })
    );
    makeSupabaseMock(rows);
    const result = await getFeed();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.page.items).toHaveLength(12);
    expect(result.page.nextCursor).not.toBeNull();
  });

  it("12 rows → nextCursor is null", async () => {
    const rows = Array.from({ length: 12 }, (_, i) =>
      makeRow({ id: `550e8400-e29b-41d4-a716-${String(i).padStart(12, "0")}`, published_at: `2026-01-${String(15 - i).padStart(2, "0")}T10:00:00.000Z` })
    );
    makeSupabaseMock(rows);
    const result = await getFeed();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.page.items).toHaveLength(12);
    expect(result.page.nextCursor).toBeNull();
  });
});

describe("getFeed keyset paging — EC3 / EC4", () => {
  it("EC3: when cursor provided, keyset OR condition is applied to the query", async () => {
    const { feedChain } = makeSupabaseMock([]);
    const cursor = encodeCursor("2026-01-10T10:00:00.000Z", "550e8400-e29b-41d4-a716-446655440000");
    await getFeed(cursor);
    // The keyset must use an OR filter: published_at < t OR (published_at = t AND id < i)
    expect(feedChain.or).toHaveBeenCalledWith(
      expect.stringContaining("published_at.lt.")
    );
    expect(feedChain.or).toHaveBeenCalledWith(
      expect.stringContaining("published_at.eq.")
    );
  });

  it("EC4: cursor pointing at a hidden item still returns ok (paging continues from key)", async () => {
    // The keyset filter uses (published_at, id) arithmetic — it does not fetch the cursor row.
    // Even if that row is later hidden, the query returns whatever comes after the key.
    makeSupabaseMock([makeRow({ id: "660e8400-e29b-41d4-a716-446655440001", published_at: "2026-01-05T10:00:00.000Z" })]);
    const cursor = encodeCursor("2026-01-10T10:00:00.000Z", "550e8400-e29b-41d4-a716-446655440000");
    const result = await getFeed(cursor);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.page.items).toHaveLength(1);
    expect(result.page.nextCursor).toBeNull();
  });
});

describe("getFeed scheduled-item filter — EC5", () => {
  it("applies lte filter on published_at to exclude future items", async () => {
    const { feedChain } = makeSupabaseMock([]);
    await getFeed();
    // The query must call .lte("published_at", <iso-string>) before .limit()
    expect(feedChain.lte).toHaveBeenCalledWith("published_at", expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/));
  });
});
