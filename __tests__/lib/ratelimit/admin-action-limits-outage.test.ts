// S-038 P2: Admin action limits — open mode allows the action through when Upstash
// is configured but times out or errors (outage scenario).
// Requires a fresh module import with a non-null upstashConfig so the Upstash
// code path is entered; the Redis client is then mocked to throw.

import { describe, it, expect, vi, beforeAll } from "vitest";

vi.mock("server-only", () => ({}));

// Non-null config so checkRateLimit enters the Upstash branch.
vi.mock("@/lib/config.upstash", () => ({
  upstashConfig: vi.fn().mockReturnValue({
    url: "https://fake.upstash.io",
    token: "fake-token",
    hashSecret: "fake-secret",
  }),
}));

// Redis pipeline throws — simulates a network timeout / outage.
vi.mock("@upstash/redis", () => ({
  Redis: vi.fn().mockImplementation(() => ({
    pipeline: () => ({
      incr: () => ({ exec: async () => { throw new Error("upstash_timeout"); } }),
      expire: () => ({ exec: async () => { throw new Error("upstash_timeout"); } }),
      del: () => ({ exec: async () => { throw new Error("upstash_timeout"); } }),
      exec: async () => { throw new Error("upstash_timeout"); },
    }),
    incr: async () => { throw new Error("upstash_timeout"); },
  })),
}));

let checkAdminWriteLimit: (id: string) => Promise<{ ok: boolean; reason?: string }>;
let checkAdminDestructiveLimit: (id: string) => Promise<{ ok: boolean; reason?: string }>;

beforeAll(async () => {
  const mod = await import("@/lib/ratelimit");
  checkAdminWriteLimit = mod.checkAdminWriteLimit;
  checkAdminDestructiveLimit = mod.checkAdminDestructiveLimit;
});

describe("open-mode outage: Upstash configured but unreachable", () => {
  it("P2: checkAdminWriteLimit returns ok:true when Upstash times out", async () => {
    const result = await checkAdminWriteLimit(`outage-actor-${Date.now()}`);
    expect(result.ok).toBe(true);
  });

  it("P2: checkAdminDestructiveLimit returns ok:true when Upstash times out", async () => {
    const result = await checkAdminDestructiveLimit(`outage-actor-${Date.now()}`);
    expect(result.ok).toBe(true);
  });
});
