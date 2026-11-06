// S-049: listCategories — AC9

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({
  serverConfig: { supabaseServiceRoleKey: "srk" },
  publicConfig: { supabaseUrl: "https://test.supabase.co", supabaseAnonKey: "anon" },
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAnonClient: vi.fn(),
}));

import { createSupabaseAnonClient } from "@/lib/supabase/server";
import { listCategories } from "@/lib/articles/listCategories";

function makeChain(rows: unknown[], error?: { message: string }) {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "order"]) {
    chain[m] = vi.fn().mockReturnThis();
  }
  chain.order = vi.fn().mockResolvedValue({ data: rows, error: error ?? null });
  (createSupabaseAnonClient as ReturnType<typeof vi.fn>).mockReturnValue({ from: vi.fn().mockReturnValue(chain) });
  return chain;
}

const CAT_ROWS = [
  { id: "cat-1", name: "Fire Safety", slug: "fire-safety" },
  { id: "cat-2", name: "Chemical Safety", slug: "chemical-safety" },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listCategories — AC9", () => {
  it("returns sorted category list", async () => {
    makeChain(CAT_ROWS);
    const result = await listCategories();
    expect(result).toHaveLength(2);
    expect(result[0].slug).toBe("fire-safety");
    expect(result[1].slug).toBe("chemical-safety");
  });

  it("returns all required fields (id, name, slug)", async () => {
    makeChain([CAT_ROWS[0]]);
    const result = await listCategories();
    expect(result[0]).toMatchObject({ id: "cat-1", name: "Fire Safety", slug: "fire-safety" });
  });

  it("returns empty array on DB error", async () => {
    makeChain([], { message: "connection refused" });
    const result = await listCategories();
    expect(result).toEqual([]);
  });

  it("returns empty array when data is null", async () => {
    const chain: Record<string, unknown> = { select: vi.fn().mockReturnThis() };
    chain.order = vi.fn().mockResolvedValue({ data: null, error: null });
    (createSupabaseAnonClient as ReturnType<typeof vi.fn>).mockReturnValue({ from: vi.fn().mockReturnValue(chain) });
    const result = await listCategories();
    expect(result).toEqual([]);
  });
});
