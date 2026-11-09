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

import { validateYoutubeId } from "../query";

describe("validateYoutubeId — AC8", () => {
  it("accepts a valid 11-char alphanumeric id", () => {
    expect(validateYoutubeId("dQw4w9WgXcW")).toBe(true);
  });

  it("accepts id with underscore and hyphen", () => {
    expect(validateYoutubeId("abc-DEF_123")).toBe(true);
  });

  it("rejects id shorter than 11 chars", () => {
    expect(validateYoutubeId("short")).toBe(false);
  });

  it("rejects id longer than 11 chars", () => {
    expect(validateYoutubeId("toolongid123")).toBe(false);
  });

  it("rejects id with invalid chars", () => {
    expect(validateYoutubeId("abc!DEF@123")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(validateYoutubeId("")).toBe(false);
  });
});
