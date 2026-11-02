// S-038 AC6: Admin write limits — 60/min general, 10/min for deletes/approvals/suspensions.
// Outage (Upstash down) → open mode → action allowed.

import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

vi.mock("server-only", () => ({}));
// upstashConfig returns null → in-memory fallback path (no Upstash, no @upstash/redis import)
vi.mock("@/lib/config.upstash", () => ({ upstashConfig: vi.fn().mockReturnValue(null) }));

// Dynamic import after mocks are set up so @upstash/redis is never resolved
let checkAdminWriteLimit: (id: string) => Promise<{ ok: boolean; reason?: string }>;
let checkAdminDestructiveLimit: (id: string) => Promise<{ ok: boolean; reason?: string }>;

beforeAll(async () => {
  const mod = await import("@/lib/ratelimit");
  checkAdminWriteLimit = mod.checkAdminWriteLimit;
  checkAdminDestructiveLimit = mod.checkAdminDestructiveLimit;
});

describe("checkAdminWriteLimit (60/min)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("AC6: allows first 60 writes within window", async () => {
    const actorId = `write-actor-${Date.now()}`;
    for (let i = 0; i < 60; i++) {
      const result = await checkAdminWriteLimit(actorId);
      expect(result.ok).toBe(true);
    }
  });

  it("AC6: blocks the 61st write in the same window", async () => {
    const actorId = `write-actor-61-${Date.now()}`;
    for (let i = 0; i < 60; i++) {
      await checkAdminWriteLimit(actorId);
    }
    const result = await checkAdminWriteLimit(actorId);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("rate_limited");
  });

  it("AC6: different actors do not share limits", async () => {
    const ts = Date.now();
    const a1 = `actor-a-${ts}`;
    const a2 = `actor-b-${ts}`;
    for (let i = 0; i < 60; i++) await checkAdminWriteLimit(a1);
    // actor a1 is at limit; actor a2 should still be OK
    const result = await checkAdminWriteLimit(a2);
    expect(result.ok).toBe(true);
  });
});

describe("checkAdminDestructiveLimit (10/min)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("AC6: allows first 10 destructive actions within window", async () => {
    const actorId = `dest-actor-${Date.now()}`;
    for (let i = 0; i < 10; i++) {
      const result = await checkAdminDestructiveLimit(actorId);
      expect(result.ok).toBe(true);
    }
  });

  it("AC6: blocks the 11th destructive action in the same window", async () => {
    const actorId = `dest-actor-11-${Date.now()}`;
    for (let i = 0; i < 10; i++) {
      await checkAdminDestructiveLimit(actorId);
    }
    const result = await checkAdminDestructiveLimit(actorId);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("rate_limited");
  });
});
