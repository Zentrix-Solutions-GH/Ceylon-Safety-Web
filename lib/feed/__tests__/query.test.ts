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

function makeSupabaseMock(feedRows: unknown[]) {
  const articlesChain = {
    select: vi.fn().mockReturnThis(),
    in: vi.fn().mockResolvedValue({ data: [], error: null }),
  };
  const feedChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: feedRows, error: null }),
  };
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

describe("getFeed scheduled-item filter — EC5", () => {
  it("applies lte filter on published_at to exclude future items", async () => {
    const { feedChain } = makeSupabaseMock([]);
    await getFeed();
    // The query must call .lte("published_at", <iso-string>) before .limit()
    expect(feedChain.lte).toHaveBeenCalledWith("published_at", expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/));
  });
});
