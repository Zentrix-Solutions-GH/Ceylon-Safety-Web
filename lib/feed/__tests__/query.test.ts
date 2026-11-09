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

import { parseCursor, encodeCursor, PAGE_SIZE } from "../query";

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
