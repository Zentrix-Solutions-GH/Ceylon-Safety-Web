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

import { validateYoutubeId, getPublishedVideo } from "../query";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

const mockCreate = vi.mocked(createSupabaseServiceRoleClient);

describe("getPublishedVideo — AC8 (bad youtube_id in DB → not_found)", () => {
  it("returns not_found when DB row has an invalid youtube_id", async () => {
    const badChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: "vid-1", youtube_id: "INVALID!!!", title: "T", description: null, thumbnail_key: "k", category_id: "c" },
        error: null,
      }),
    };
    mockCreate.mockReturnValue({ from: vi.fn(() => badChain) } as never);
    const result = await getPublishedVideo("550e8400-e29b-41d4-a716-446655440000");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_found");
  });

  it("returns video when DB row has a valid youtube_id", async () => {
    const goodChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: "vid-1", youtube_id: "dQw4w9WgXcW", title: "T", description: null, thumbnail_key: "k", category_id: "c" },
        error: null,
      }),
    };
    mockCreate.mockReturnValue({ from: vi.fn(() => goodChain) } as never);
    const result = await getPublishedVideo("550e8400-e29b-41d4-a716-446655440000");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.video.youtubeId).toBe("dQw4w9WgXcW");
      expect(result.video.categoryId).toBe("c");
    }
  });
});

describe("getPublishedVideo — AC8 (DB row absent → not_found)", () => {
  it("returns not_found when no row matches the video id", async () => {
    const notFoundChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST116", message: "not found" } }),
    };
    mockCreate.mockReturnValue({ from: vi.fn(() => notFoundChain) } as never);
    const result = await getPublishedVideo("550e8400-e29b-41d4-a716-000000000000");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_found");
  });
});

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
