import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({
  serverConfig: { supabaseServiceRoleKey: "srk" },
  publicConfig: { supabaseUrl: "https://test.supabase.co", supabaseAnonKey: "anon" },
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: vi.fn(),
}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getCounters } from "../index";

const mockCreate = vi.mocked(createSupabaseServiceRoleClient);

function makeSupabaseMock(countersRow: Record<string, number | null>, settingsRows: { key: string; value: string }[] = []) {
  const countersChain = { select: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: countersRow, error: null }) };
  const settingsChain = { select: vi.fn().mockReturnThis(), in: vi.fn().mockResolvedValue({ data: settingsRows, error: null }) };
  mockCreate.mockReturnValue({
    from: vi.fn((table: string) => (table === "home_counters" ? countersChain : settingsChain)),
  } as never);
}

describe("getCounters — AC6", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns rounded counters from home_counters view with defaults", async () => {
    makeSupabaseMock({ published_articles: 55, published_documents: 10, registered_users: 9, total_downloads: 1234 });
    const result = await getCounters();
    expect(result.articles).toBe(50);    // 55 → rounds to 50
    expect(result.documents).toBe(10);   // 10 → 10
    expect(result.users).toBeNull();      // 9 < min 10 → null
    expect(result.downloads).toBe(1000); // 1234 → 1000
  });

  it("returns all null when home_counters query errors", async () => {
    const chain = { select: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error: new Error("db error") }) };
    mockCreate.mockReturnValue({ from: vi.fn(() => chain) } as never);
    const result = await getCounters();
    expect(result).toEqual({ articles: null, documents: null, users: null, downloads: null });
  });

  it("applies custom settings when site_settings rows are present", async () => {
    makeSupabaseMock(
      { published_articles: 30, published_documents: 0, registered_users: 5, total_downloads: 100 },
      [{ key: "counters_min_visible", value: "5" }, { key: "counters_rounding", value: "[5,25,100]" }]
    );
    const result = await getCounters();
    expect(result.articles).toBe(25);  // 30 with ladder [5,25,100] → 25
    expect(result.documents).toBeNull(); // 0 < min 5 → null
    expect(result.users).toBe(5);       // 5 === min → 5
    expect(result.downloads).toBe(100); // 100 === ladder top → 100
  });

  it("applies valid min even when ladder is a bare number (not array)", async () => {
    // counters_rounding="100" is not a JSON array → ladder falls back to DEFAULT_LADDER
    // but counters_min_visible="5" is valid and must still be applied (min=5, not 10)
    makeSupabaseMock(
      { published_articles: 7, published_documents: 10, registered_users: 4, total_downloads: 55 },
      [{ key: "counters_min_visible", value: "5" }, { key: "counters_rounding", value: "100" }]
    );
    const result = await getCounters();
    expect(result.articles).toBe(5);    // 7 >= min(5); no ladder step <= 7 → returns min(5)
    expect(result.documents).toBe(10);  // 10 >= min(5); ladder step 10 <= 10 → 10
    expect(result.users).toBeNull();    // 4 < min(5) → null
    expect(result.downloads).toBe(50);  // 55 >= min(5); largest ladder step <= 55 is 50
  });

  it("falls back to defaults when site_settings values are malformed (EC8)", async () => {
    makeSupabaseMock(
      { published_articles: 55, published_documents: 10, registered_users: 9, total_downloads: 1234 },
      [{ key: "counters_min_visible", value: "not-a-number" }, { key: "counters_rounding", value: "invalid-json" }]
    );
    const result = await getCounters();
    // malformed → fall back to defaults: min=10, ladder=[10,50,100,1000]
    expect(result.articles).toBe(50);
    expect(result.documents).toBe(10);
    expect(result.users).toBeNull();
    expect(result.downloads).toBe(1000);
  });
});
