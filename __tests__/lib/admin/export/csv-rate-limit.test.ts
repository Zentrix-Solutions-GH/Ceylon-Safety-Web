import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Module factory — re-imports with fresh module registry (and optional Upstash mock)
// ---------------------------------------------------------------------------

async function importModule(upstashAvailable = false) {
  vi.resetModules();

  if (upstashAvailable) {
    // Minimal Upstash pipeline mock: INCR increments a shared counter; EXPIRE is a no-op.
    let counter = 0;
    vi.doMock("@upstash/redis", () => ({
      Redis: vi.fn().mockImplementation(() => ({
        pipeline: () => {
          const ops: Array<() => number | undefined> = [];
          const pipe = {
            incr(_key: string) {
              ops.push(() => { counter += 1; return counter; });
              return pipe;
            },
            expire(_key: string, _ttl: number) {
              ops.push(() => undefined);
              return pipe;
            },
            async exec() { return ops.map((fn) => fn()); },
          };
          return pipe;
        },
      })),
    }));
    process.env.UPSTASH_REDIS_REST_URL = "https://fake.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token";
    process.env.RATELIMIT_HASH_SECRET = "a".repeat(64);
  } else {
    vi.doMock("@upstash/redis", () => ({ Redis: vi.fn() }));
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  }

  const mod = await import("@/lib/admin/export/csv-rate-limit");
  return mod;
}

beforeEach(() => {
  vi.resetModules();
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

// ---------------------------------------------------------------------------
// In-memory path (no Upstash)
// ---------------------------------------------------------------------------

describe("in-memory fallback: 3 exports allowed, 4th blocked", () => {
  it("allows first 3 calls for the same adminId", async () => {
    const { checkExportRateLimit } = await importModule(false);
    const id = `admin-mem-${Date.now()}`;

    for (let i = 0; i < 3; i++) {
      const result = await checkExportRateLimit(id);
      expect(result.allowed).toBe(true);
    }
  });

  it("blocks the 4th call and returns retryAfterSeconds > 0", async () => {
    const { checkExportRateLimit } = await importModule(false);
    const id = `admin-block-${Date.now()}`;

    for (let i = 0; i < 3; i++) {
      await checkExportRateLimit(id);
    }
    const result = await checkExportRateLimit(id);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("different adminIds have independent counters", async () => {
    const { checkExportRateLimit } = await importModule(false);
    const id1 = `admin-a-${Date.now()}`;
    const id2 = `admin-b-${Date.now()}`;

    for (let i = 0; i < 3; i++) {
      await checkExportRateLimit(id1);
    }
    // id1 is at limit; id2 should still be allowed
    const result = await checkExportRateLimit(id2);
    expect(result.allowed).toBe(true);
  });

  it("counter resets after resetsAt elapses", async () => {
    vi.useFakeTimers();
    const { checkExportRateLimit } = await importModule(false);
    const id = `admin-reset-${Date.now()}`;

    for (let i = 0; i < 3; i++) {
      await checkExportRateLimit(id);
    }
    expect((await checkExportRateLimit(id)).allowed).toBe(false);

    // Advance past midnight (> 86400 s)
    vi.advanceTimersByTime(87_000 * 1000);

    const after = await checkExportRateLimit(id);
    expect(after.allowed).toBe(true);
    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// secondsUntilMidnightColombo: value in [1, 86400]
// ---------------------------------------------------------------------------

describe("secondsUntilMidnightColombo returns a sane value", () => {
  it("retryAfterSeconds is between 1 and 86400 when rate-limited", async () => {
    const { checkExportRateLimit } = await importModule(false);
    const id = `admin-ttl-${Date.now()}`;

    for (let i = 0; i < 3; i++) {
      await checkExportRateLimit(id);
    }
    const { retryAfterSeconds } = await checkExportRateLimit(id);
    expect(retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(retryAfterSeconds).toBeLessThanOrEqual(86_400);
  });
});
