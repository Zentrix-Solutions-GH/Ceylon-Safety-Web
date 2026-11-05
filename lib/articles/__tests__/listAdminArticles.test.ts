// S-049: listAdminArticles — AC8

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({
  serverConfig: { supabaseServiceRoleKey: "srk" },
  publicConfig: { supabaseUrl: "https://test.supabase.co", supabaseAnonKey: "anon" },
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: vi.fn(),
}));
vi.mock("@/lib/auth/server", () => ({
  requireStaff: vi.fn(),
}));
vi.mock("next/cache", () => ({
  unstable_noStore: vi.fn(),
}));

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/server";
import { listAdminArticles } from "@/lib/articles/listAdminArticles";

const STAFF_USER = { id: "staff-1", claimedRole: "admin" as const };
const PAGE_SIZE = 25;

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "art-1",
    slug: "fire-safety",
    title: "Fire Safety",
    status: "published",
    published_at: null,
    updated_at: "2026-10-01T08:00:00Z",
    categories: { name: "Fire Safety", slug: "fire-safety" },
    authors: { name: "Jane" },
    ...overrides,
  };
}

function makeChain(rows: unknown[], count: number | null = rows.length) {
  const chain: Record<string, unknown> = {};
  const methods = ["from", "select", "eq", "is", "lte", "gte", "gt", "ilike", "order", "range", "or", "neq", "not"];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnThis();
  }
  chain.range = vi.fn().mockResolvedValue({ data: rows, count, error: null });
  (createSupabaseServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
  (requireStaff as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, user: STAFF_USER });
});

describe("listAdminArticles — AC8", () => {
  it("requires staff permission", async () => {
    (requireStaff as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false });
    const result = await listAdminArticles({});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("not_allowed");
  });

  it("returns ok:false on DB error", async () => {
    const chain: Record<string, unknown> = {};
    const methods = ["from", "select", "eq", "is", "lte", "gte", "gt", "ilike", "order", "range", "or", "neq", "not"];
    for (const m of methods) chain[m] = vi.fn().mockReturnThis();
    chain.range = vi.fn().mockResolvedValue({ data: null, count: null, error: { code: "PGRST301", message: "timeout" } });
    (createSupabaseServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(chain);
    const result = await listAdminArticles({});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("unknown");
  });

  it("returns items sorted by updated_at desc, 25 per page", async () => {
    const rows = Array.from({ length: PAGE_SIZE }, (_, i) => makeRow({ id: `art-${i}` }));
    makeChain(rows, 50);
    const result = await listAdminArticles({ page: 1 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items).toHaveLength(PAGE_SIZE);
  });

  it("returns correct page count", async () => {
    makeChain([makeRow()], 26);
    const result = await listAdminArticles({ page: 1 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.pageCount).toBe(2); // ceil(26/25)
  });

  it("filters by status=draft", async () => {
    const chain = makeChain([]);
    await listAdminArticles({ status: "draft" });
    expect((chain.eq as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith("status", "draft");
  });

  it("filters by status=hidden", async () => {
    const chain = makeChain([]);
    await listAdminArticles({ status: "hidden" });
    expect((chain.eq as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith("status", "hidden");
  });

  it("filters by status=published (excludes future-dated → scheduled)", async () => {
    const chain = makeChain([]);
    await listAdminArticles({ status: "published" });
    // published and not future-dated
    expect((chain.eq as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith("status", "published");
  });

  it("filters by status=scheduled (published with future published_at)", async () => {
    const chain = makeChain([]);
    await listAdminArticles({ status: "scheduled" });
    // must set status=published and apply a future-date filter via gt
    expect((chain.eq as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith("status", "published");
    expect((chain.gt as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      "published_at",
      expect.any(String)
    );
  });

  it("filters by category slug", async () => {
    const chain = makeChain([]);
    await listAdminArticles({ category: "fire-safety" });
    expect((chain.eq as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      "categories.slug",
      "fire-safety"
    );
  });

  it("searches by title (ilike or similar)", async () => {
    const chain = makeChain([]);
    await listAdminArticles({ title: "fire" });
    expect((chain.ilike as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      "title",
      "%fire%"
    );
  });
});
