import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Module factory — re-imports with fresh module registry (and optional Upstash mock)
// ---------------------------------------------------------------------------

async function importModule(upstashAvailable = false) {
  vi.resetModules();

  if (upstashAvailable) {
    // Minimal Upstash mock: incr increments a shared counter; expire is a no-op.
    let counter = 0;
    vi.doMock("@upstash/redis", () => ({
      Redis: vi.fn().mockImplementation(() => ({
        incr() { return Promise.resolve(++counter); },
        expire() { return Promise.resolve(1); },
      })),
    }));
    process.env.UPSTASH_REDIS_REST_URL = "https://fake.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token";
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

// ---------------------------------------------------------------------------
// Upstash Redis path (upstashAvailable = true)
// ---------------------------------------------------------------------------

describe("Upstash Redis path: 3 exports allowed, 4th blocked", () => {
  it("allows first 3 calls for the same adminId", async () => {
    const { checkExportRateLimit } = await importModule(true);
    const id = `admin-redis-${Date.now()}`;

    for (let i = 0; i < 3; i++) {
      const result = await checkExportRateLimit(id);
      expect(result.allowed).toBe(true);
    }
  });

  it("blocks the 4th call and returns retryAfterSeconds > 0", async () => {
    const { checkExportRateLimit } = await importModule(true);
    const id = `admin-redis-block-${Date.now()}`;

    for (let i = 0; i < 3; i++) {
      await checkExportRateLimit(id);
    }
    const result = await checkExportRateLimit(id);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("fails open when redis.incr throws", async () => {
    vi.resetModules();
    vi.doMock("@upstash/redis", () => ({
      Redis: vi.fn().mockImplementation(() => ({
        incr() { return Promise.reject(new Error("connection refused")); },
        expire() { return Promise.resolve(1); },
      })),
    }));
    process.env.UPSTASH_REDIS_REST_URL = "https://fake.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token";
    const { checkExportRateLimit } = await import("@/lib/admin/export/csv-rate-limit");

    const result = await checkExportRateLimit("admin-fail-open");
    expect(result.allowed).toBe(true);
  });

  it("4th export blocked even when expire throws — INCR counter is authoritative", async () => {
    // expire throws; the INCR counter must still enforce the 3-per-day limit.
    // The inner try/catch on expire must not swallow the count so that blocking
    // still kicks in on the 4th call.
    let counter = 0;
    vi.resetModules();
    vi.doMock("@upstash/redis", () => ({
      Redis: vi.fn().mockImplementation(() => ({
        incr() { return Promise.resolve(++counter); },
        expire() { return Promise.reject(new Error("expire unsupported")); },
      })),
    }));
    process.env.UPSTASH_REDIS_REST_URL = "https://fake.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token";
    const { checkExportRateLimit } = await import("@/lib/admin/export/csv-rate-limit");
    const id = `admin-expire-throw-${Date.now()}`;

    const r1 = await checkExportRateLimit(id);
    const r2 = await checkExportRateLimit(id);
    const r3 = await checkExportRateLimit(id);
    const r4 = await checkExportRateLimit(id);

    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(true);
    expect(r4.allowed).toBe(false); // 4th call blocked by counter despite expire having no TTL
  });
});
