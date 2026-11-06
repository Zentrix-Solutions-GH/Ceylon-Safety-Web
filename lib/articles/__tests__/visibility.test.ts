// S-049: visibility rules — AC3, EC1

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({
  serverConfig: { supabaseServiceRoleKey: "srk" },
  publicConfig: { supabaseUrl: "https://test.supabase.co", supabaseAnonKey: "anon" },
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAnonClient: vi.fn(),
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

import { createSupabaseAnonClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getArticle } from "@/lib/articles/getArticle";
import { listArticles } from "@/lib/articles/listArticles";

function makeSlugChain(row: unknown | null, error?: { message: string }) {
  const chain: Record<string, unknown> = {};
  const methods = ["from", "select", "eq", "is", "lte", "single", "maybeSingle", "in"];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnThis();
  }
  (chain as Record<string, unknown>).maybeSingle = vi
    .fn()
    .mockResolvedValue({ data: row, error: error ?? null });
  (chain as Record<string, unknown>).in = vi.fn().mockResolvedValue({ data: [], error: null });
  const supabase = { from: vi.fn().mockReturnValue(chain) };
  // getArticle uses anon client; resolveRefs uses service-role
  (createSupabaseAnonClient as ReturnType<typeof vi.fn>).mockReturnValue(supabase);
  (createSupabaseServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(supabase);
  return chain;
}

function makeListChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  const methods = ["from", "select", "eq", "is", "lte", "gte", "order", "limit", "or", "lt", "in"];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnThis();
  }
  chain.limit = vi.fn().mockResolvedValue({ data: rows, error: null });
  chain.in = vi.fn().mockResolvedValue({ data: [], error: null });
  const supabase = { from: vi.fn().mockReturnValue(chain) };
  (createSupabaseAnonClient as ReturnType<typeof vi.fn>).mockReturnValue(supabase);
  (createSupabaseServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(supabase);
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── AC3: visibility rule is applied on every public read ────────────────────

describe("visibility — AC3 getArticle", () => {
  it("applies status=published filter", async () => {
    const chain = makeSlugChain(null);
    await getArticle("some-slug");
    expect((chain.eq as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      "status",
      "published"
    );
  });

  it("applies published_at <= now filter", async () => {
    const chain = makeSlugChain(null);
    await getArticle("some-slug");
    expect((chain.lte as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      "published_at",
      expect.any(String)
    );
  });

  it("applies deleted_at IS NULL filter", async () => {
    const chain = makeSlugChain(null);
    await getArticle("some-slug");
    expect((chain.is as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      "deleted_at",
      null
    );
  });
});

describe("visibility — AC3 listArticles", () => {
  it("applies status=published filter in list", async () => {
    const chain = makeListChain([]);
    await listArticles({});
    expect((chain.eq as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      "status",
      "published"
    );
  });

  it("applies published_at <= now in list", async () => {
    const chain = makeListChain([]);
    await listArticles({});
    expect((chain.lte as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      "published_at",
      expect.any(String)
    );
  });

  it("applies deleted_at IS NULL in list (AC3)", async () => {
    const chain = makeListChain([]);
    await listArticles({});
    expect((chain.is as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      "deleted_at",
      null
    );
  });
});

// ─── EC1: a scheduled article is never returned before its time ──────────────

describe("visibility — EC1 scheduled article", () => {
  it("getArticle returns not_found for future-dated article (db returns null)", async () => {
    // DB enforces published_at <= now(); our function should return not_found when db returns null
    makeSlugChain(null);
    const result = await getArticle("future-article");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("not_found");
  });
});
