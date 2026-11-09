import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({
  serverConfig: {
    supabaseServiceRoleKey: "srk",
    feedRateLimitPerMinute: 60,
    countersRateLimitPerMinute: 60,
  },
  publicConfig: { supabaseUrl: "https://test.supabase.co", supabaseAnonKey: "anon" },
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: vi.fn(),
}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("@/lib/ratelimit", () => ({
  checkRateLimit: vi.fn(),
}));

import { checkRateLimit } from "@/lib/ratelimit";
import { applyFeedRateLimit } from "../query";
import { applyCountersRateLimit } from "@/lib/counters";

const mockCheckRateLimit = vi.mocked(checkRateLimit);

describe("applyFeedRateLimit — AC9", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns ok when rate limit passes", async () => {
    mockCheckRateLimit.mockResolvedValue({ ok: true });
    const result = await applyFeedRateLimit("127.0.0.1");
    expect(result.ok).toBe(true);
  });

  it("returns rate_limited when limit exceeded", async () => {
    mockCheckRateLimit.mockResolvedValue({ ok: false, reason: "rate_limited" });
    const result = await applyFeedRateLimit("127.0.0.1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("rate_limited");
  });
});

describe("applyCountersRateLimit — AC9", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns ok when rate limit passes", async () => {
    mockCheckRateLimit.mockResolvedValue({ ok: true });
    const result = await applyCountersRateLimit("127.0.0.1");
    expect(result.ok).toBe(true);
  });

  it("returns rate_limited when limit exceeded", async () => {
    mockCheckRateLimit.mockResolvedValue({ ok: false, reason: "rate_limited" });
    const result = await applyCountersRateLimit("127.0.0.1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("rate_limited");
  });
});
