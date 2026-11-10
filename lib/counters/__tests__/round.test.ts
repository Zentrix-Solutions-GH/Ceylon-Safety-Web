import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({
  serverConfig: { supabaseServiceRoleKey: "srk", feedRateLimitPerMinute: 60, countersRateLimitPerMinute: 60 },
  publicConfig: { supabaseUrl: "https://test.supabase.co", supabaseAnonKey: "anon" },
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: vi.fn(),
}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));

import { roundCounter } from "../index";

describe("roundCounter — AC7", () => {
  it("returns null for values below minimum (9 → null)", () => {
    expect(roundCounter(9)).toBeNull();
  });

  it("returns 10 for value equal to minimum (10 → 10)", () => {
    expect(roundCounter(10)).toBe(10);
  });

  it("rounds down to nearest ladder step (55 → 50)", () => {
    expect(roundCounter(55)).toBe(50);
  });

  it("rounds down at boundary (100 → 100)", () => {
    expect(roundCounter(100)).toBe(100);
  });

  it("rounds down to 1000 for large values (1234 → 1000)", () => {
    expect(roundCounter(1234)).toBe(1000);
  });

  it("rounds down to multiple of 1000 for very large values (5678 → 5000)", () => {
    expect(roundCounter(5678)).toBe(5000);
  });

  it("handles exact 1000 (1000 → 1000)", () => {
    expect(roundCounter(1000)).toBe(1000);
  });

  it("handles 0 → null", () => {
    expect(roundCounter(0)).toBeNull();
  });

  it("accepts custom min and ladder via settings", () => {
    expect(roundCounter(5, { min: 5, ladder: [5, 25, 100] })).toBe(5);
    expect(roundCounter(30, { min: 5, ladder: [5, 25, 100] })).toBe(25);
  });

  it("uses defaults when settings are null (EC8)", () => {
    expect(roundCounter(55, null)).toBe(50);
  });
});
