import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Helpers to capture calls into a fake Redis pipeline
// ---------------------------------------------------------------------------

type FakeRedisCall = { cmd: string; args: unknown[] };

function makeFakeRedis(scenario: "ok" | "over" | "timeout" | "error" | "expire_timeout" = "ok") {
  const calls: FakeRedisCall[] = [];
  let counter = 0;
  let pipelineCallCount = 0;

  return {
    calls,
    reset() {
      calls.length = 0;
      counter = 0;
      pipelineCallCount = 0;
    },
    // @upstash/redis pipeline mock
    pipeline() {
      pipelineCallCount += 1;
      const thisCall = pipelineCallCount;
      const ops: Array<() => Promise<unknown>> = [];
      const pipe = {
        incr(key: string) {
          calls.push({ cmd: "incr", args: [key] });
          ops.push(async () => {
            if (scenario === "timeout") throw new Error("fetch timeout");
            if (scenario === "error") throw Object.assign(new Error("status 503"), { status: 503 });
            counter += 1;
            return counter;
          });
          return pipe;
        },
        expire(key: string, ttl: number) {
          calls.push({ cmd: "expire", args: [key, ttl] });
          ops.push(async () => ttl);
          return pipe;
        },
        del(key: string) {
          calls.push({ cmd: "del", args: [key] });
          ops.push(async () => 1);
          return pipe;
        },
        async exec() {
          if (scenario === "timeout") {
            await new Promise((_, rej) => setTimeout(() => rej(new Error("fetch timeout")), 10));
          }
          if (scenario === "error") {
            throw Object.assign(new Error("status 503"), { status: 503 });
          }
          // expire_timeout: INCR pipeline (call 1) succeeds; EXPIRE pipeline (call 2) times out;
          // DEL pipeline (call 3) succeeds — simulates partial Upstash failure.
          if (scenario === "expire_timeout" && thisCall === 2) {
            await new Promise((_, rej) => setTimeout(() => rej(new Error("fetch timeout")), 10));
          }
          return Promise.all(ops.map((fn) => fn()));
        },
      };
      return pipe;
    },
  };
}

// ---------------------------------------------------------------------------
// Module factory helper — re-imports with a fresh module registry each time
// ---------------------------------------------------------------------------

async function importRateLimit(
  env: Record<string, string | undefined>,
  redisScenario: "ok" | "over" | "timeout" | "error" | "expire_timeout" = "ok"
) {
  // Patch env
  const original = { ...process.env };
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }

  const fakeRedis = makeFakeRedis(redisScenario);

  vi.doMock("@upstash/redis", () => ({
    Redis: vi.fn().mockImplementation(() => fakeRedis),
  }));

  // Dynamic import with cache busting
  vi.resetModules();
  const mod = await import("../lib/ratelimit/index");

  // Restore env
  for (const k of Object.keys(env)) {
    if (original[k] === undefined) delete process.env[k];
    else process.env[k] = original[k];
  }

  return { mod, fakeRedis };
}

const prodEnv = {
  UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
  UPSTASH_REDIS_REST_TOKEN: "token123",
  RATELIMIT_HASH_SECRET: "a".repeat(64),
  NODE_ENV: "production",
};

const devEnv = {
  UPSTASH_REDIS_REST_URL: undefined,
  UPSTASH_REDIS_REST_TOKEN: undefined,
  RATELIMIT_HASH_SECRET: undefined,
  NODE_ENV: "development",
};

// ---------------------------------------------------------------------------
// AC1 — under and over the limit
// ---------------------------------------------------------------------------

describe("AC1: limit check", () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.restoreAllMocks());

  it("allows when under the limit", async () => {
    const { mod } = await importRateLimit(prodEnv, "ok");
    const result = await mod.checkRateLimit({
      limitName: "signup",
      key: "test@example.com",
      maxCount: 5,
      windowSeconds: 3600,
      mode: "closed",
    });
    expect(result.ok).toBe(true);
  });

  it("refuses when over the limit and returns retryAfterSeconds", async () => {
    // Simulate counter already at max by calling 6 times with maxCount=5
    // We use the in-memory fallback (dev env) for determinism
    vi.resetModules();
    const { mod } = await importRateLimit(devEnv, "ok");

    for (let i = 0; i < 5; i++) {
      await mod.checkRateLimit({
        limitName: "signup_ip",
        key: "1.2.3.4",
        maxCount: 5,
        windowSeconds: 60,
        mode: "open",
      });
    }
    const result = await mod.checkRateLimit({
      limitName: "signup_ip",
      key: "1.2.3.4",
      maxCount: 5,
      windowSeconds: 60,
      mode: "open",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.retryAfterSeconds).toBeGreaterThan(0);
      expect(result.reason).toBe("rate_limited");
    }
  });
});

// ---------------------------------------------------------------------------
// AC2 — key sent to Upstash is a hash; clear email/IP never appears
// ---------------------------------------------------------------------------

describe("AC2: key hashing", () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.restoreAllMocks());

  it("stores a hash, not the raw email", async () => {
    const { fakeRedis } = await importRateLimit(prodEnv, "ok");
    const { checkRateLimit } = await import("../lib/ratelimit/index");

    await checkRateLimit({
      limitName: "signup",
      key: "user@example.com",
      maxCount: 10,
      windowSeconds: 3600,
      mode: "closed",
    });

    const incrCall = fakeRedis.calls.find((c) => c.cmd === "incr");
    expect(incrCall).toBeDefined();
    const storedKey = incrCall!.args[0] as string;
    expect(storedKey).not.toContain("user@example.com");
    expect(storedKey).not.toContain("example.com");
    // Should look like hex hash
    expect(storedKey).toMatch(/[0-9a-f]{16,}/);
  });

  it("key includes the env prefix", async () => {
    const { fakeRedis } = await importRateLimit({ ...prodEnv, NODE_ENV: "production" }, "ok");
    const { checkRateLimit } = await import("../lib/ratelimit/index");

    await checkRateLimit({ limitName: "login", key: "x@x.com", maxCount: 5, windowSeconds: 60, mode: "closed" });

    const incrCall = fakeRedis.calls.find((c) => c.cmd === "incr");
    expect(incrCall!.args[0] as string).toMatch(/^prod:/);
  });

  it("normalises the key before hashing (trim + lowercase)", async () => {
    const { fakeRedis: r1 } = await importRateLimit(prodEnv, "ok");
    const { checkRateLimit: rl1 } = await import("../lib/ratelimit/index");
    await rl1({ limitName: "n", key: "  User@Example.COM  ", maxCount: 5, windowSeconds: 60, mode: "open" });
    const key1 = (r1.calls.find((c) => c.cmd === "incr")!.args[0]) as string;

    vi.resetModules();
    const { fakeRedis: r2 } = await importRateLimit(prodEnv, "ok");
    const { checkRateLimit: rl2 } = await import("../lib/ratelimit/index");
    await rl2({ limitName: "n", key: "user@example.com", maxCount: 5, windowSeconds: 60, mode: "open" });
    const key2 = (r2.calls.find((c) => c.cmd === "incr")!.args[0]) as string;

    expect(key1).toBe(key2);
  });
});

// ---------------------------------------------------------------------------
// AC3 — outage: open mode allows, closed mode refuses; onOutage called
// ---------------------------------------------------------------------------

describe("AC3: outage behaviour", () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.restoreAllMocks());

  it("open mode allows on timeout", async () => {
    await importRateLimit(prodEnv, "timeout");
    const { checkRateLimit } = await import("../lib/ratelimit/index");
    const onOutage = vi.fn();
    const result = await checkRateLimit({
      limitName: "search",
      key: "1.2.3.4",
      maxCount: 30,
      windowSeconds: 60,
      mode: "open",
      onOutage,
    });
    expect(result.ok).toBe(true);
    expect(onOutage).toHaveBeenCalledOnce();
  });

  it("closed mode refuses on timeout with reason unavailable", async () => {
    await importRateLimit(prodEnv, "timeout");
    const { checkRateLimit } = await import("../lib/ratelimit/index");
    const onOutage = vi.fn();
    const result = await checkRateLimit({
      limitName: "signup",
      key: "u@e.com",
      maxCount: 5,
      windowSeconds: 3600,
      mode: "closed",
      onOutage,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("unavailable");
    expect(onOutage).toHaveBeenCalledOnce();
  });

  it("closed mode refuses on error status with reason unavailable", async () => {
    await importRateLimit(prodEnv, "error");
    const { checkRateLimit } = await import("../lib/ratelimit/index");
    const onOutage = vi.fn();
    const result = await checkRateLimit({
      limitName: "signin",
      key: "u@e.com",
      maxCount: 5,
      windowSeconds: 3600,
      mode: "closed",
      onOutage,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("unavailable");
    expect(onOutage).toHaveBeenCalledOnce();
  });

  it("onOutage receives limitName and mode", async () => {
    await importRateLimit(prodEnv, "timeout");
    const { checkRateLimit } = await import("../lib/ratelimit/index");
    const onOutage = vi.fn();
    await checkRateLimit({
      limitName: "reset",
      key: "u@e.com",
      maxCount: 3,
      windowSeconds: 3600,
      mode: "closed",
      onOutage,
    });
    expect(onOutage).toHaveBeenCalledWith(
      expect.objectContaining({ limitName: "reset", mode: "closed" })
    );
  });
});

// ---------------------------------------------------------------------------
// AC4 — in-memory fallback when Upstash absent; production fails at startup
// ---------------------------------------------------------------------------

describe("AC4: in-memory fallback and production startup", () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.restoreAllMocks());

  it("uses in-memory limiter when Upstash env vars absent (non-production)", async () => {
    const { mod } = await importRateLimit(devEnv, "ok");
    const result = await mod.checkRateLimit({
      limitName: "test",
      key: "any",
      maxCount: 10,
      windowSeconds: 60,
      mode: "open",
    });
    expect(result.ok).toBe(true);
  });

  it("in-memory limiter enforces the limit", async () => {
    const { mod } = await importRateLimit(devEnv, "ok");
    for (let i = 0; i < 3; i++) {
      await mod.checkRateLimit({ limitName: "x", key: "k", maxCount: 3, windowSeconds: 60, mode: "open" });
    }
    const result = await mod.checkRateLimit({ limitName: "x", key: "k", maxCount: 3, windowSeconds: 60, mode: "open" });
    expect(result.ok).toBe(false);
  });

  it("throws at module load in production when UPSTASH_REDIS_REST_URL missing", async () => {
    const noUpstash = { ...prodEnv, UPSTASH_REDIS_REST_URL: undefined };
    await expect(importRateLimit(noUpstash, "ok")).rejects.toThrow(/UPSTASH_REDIS_REST_URL|config/i);
  });
});

// ---------------------------------------------------------------------------
// EC1 — two requests at the boundary: exactly maxCount succeed
// ---------------------------------------------------------------------------

describe("EC1: boundary exactness", () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.restoreAllMocks());

  it("exactly maxCount requests succeed, the next one is refused (sequential)", async () => {
    const { mod } = await importRateLimit(devEnv, "ok");
    const N = 4;
    const results: Awaited<ReturnType<typeof mod.checkRateLimit>>[] = [];
    for (let i = 0; i < N + 1; i++) {
      results.push(
        await mod.checkRateLimit({ limitName: "boundary_seq", key: "shared_seq", maxCount: N, windowSeconds: 60, mode: "open" })
      );
    }
    expect(results.slice(0, N).every((r) => r.ok)).toBe(true);
    expect(results[N].ok).toBe(false);
  });

  it("exactly maxCount concurrent requests to the same key succeed, the (N+1)th is refused", async () => {
    const { mod } = await importRateLimit(devEnv, "ok");
    const N = 4;
    // Dispatch N+1 concurrent calls to the same key
    const concurrent = await Promise.all(
      Array.from({ length: N + 1 }, () =>
        mod.checkRateLimit({ limitName: "boundary_concurrent", key: "shared_concurrent", maxCount: N, windowSeconds: 60, mode: "open" })
      )
    );
    const passed = concurrent.filter((r) => r.ok).length;
    const refused = concurrent.filter((r) => !r.ok).length;
    expect(passed).toBe(N);
    expect(refused).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// EC4 — very long or odd email: same hash as normalised version
// ---------------------------------------------------------------------------

describe("EC4: key normalisation edge cases", () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.restoreAllMocks());

  it("very long email produces a fixed-length hash", async () => {
    const { fakeRedis } = await importRateLimit(prodEnv, "ok");
    const { checkRateLimit } = await import("../lib/ratelimit/index");
    const longEmail = "a".repeat(500) + "@example.com";
    await checkRateLimit({ limitName: "n", key: longEmail, maxCount: 5, windowSeconds: 60, mode: "open" });
    const key = fakeRedis.calls.find((c) => c.cmd === "incr")!.args[0] as string;
    // SHA-256 hex is always 64 chars; our key includes prefix so >= 64
    expect(key.replace(/^[^:]+:/, "").length).toBeLessThanOrEqual(128);
  });
});

// ---------------------------------------------------------------------------
// EC5 — error status treated same as timeout (outage)
// ---------------------------------------------------------------------------

describe("EC5: error status as outage", () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.restoreAllMocks());

  it("closed mode refuses with unavailable on error status", async () => {
    await importRateLimit(prodEnv, "error");
    const { checkRateLimit } = await import("../lib/ratelimit/index");
    const result = await checkRateLimit({
      limitName: "signup",
      key: "u@e.com",
      maxCount: 5,
      windowSeconds: 3600,
      mode: "closed",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("unavailable");
  });
});

// ---------------------------------------------------------------------------
// P0 fix — EXPIRE pipeline failure: key is deleted so next request starts fresh
// ---------------------------------------------------------------------------

describe("P0: EXPIRE failure deletes key to prevent permanent block", () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.restoreAllMocks());

  it("deletes the key when EXPIRE pipeline times out (open mode allows current request)", async () => {
    const { fakeRedis } = await importRateLimit(prodEnv, "expire_timeout");
    const { checkRateLimit } = await import("../lib/ratelimit/index");

    const result = await checkRateLimit({
      limitName: "signin",
      key: "u@e.com",
      maxCount: 5,
      windowSeconds: 60,
      mode: "open",
    });

    // Current request is allowed (INCR succeeded, count=1 ≤ maxCount=5)
    expect(result.ok).toBe(true);

    // INCR was called, then EXPIRE (which timed out), then DEL (cleanup)
    const cmds = fakeRedis.calls.map((c) => c.cmd);
    expect(cmds).toContain("incr");
    expect(cmds).toContain("expire");
    expect(cmds).toContain("del"); // DEL must be called to reset the no-TTL key
  });

  it("deletes the same key that was INCRed", async () => {
    const { fakeRedis } = await importRateLimit(prodEnv, "expire_timeout");
    const { checkRateLimit } = await import("../lib/ratelimit/index");

    await checkRateLimit({
      limitName: "signin",
      key: "u@e.com",
      maxCount: 5,
      windowSeconds: 60,
      mode: "open",
    });

    const incrKey = fakeRedis.calls.find((c) => c.cmd === "incr")!.args[0] as string;
    const delKey = fakeRedis.calls.find((c) => c.cmd === "del")!.args[0] as string;
    expect(delKey).toBe(incrKey);
  });
});

// ---------------------------------------------------------------------------
// EC6 — different hashing secret produces a different key (counter reset on rotation)
// ---------------------------------------------------------------------------

describe("EC6: hashing secret rotation resets counters", () => {
  it("two different secrets produce different hashed keys", async () => {
    vi.resetModules();
    const { fakeRedis: r1 } = await importRateLimit(prodEnv, "ok");
    const { checkRateLimit: rl1 } = await import("../lib/ratelimit/index");
    await rl1({ limitName: "n", key: "u@e.com", maxCount: 5, windowSeconds: 60, mode: "open" });
    const key1 = (r1.calls.find((c) => c.cmd === "incr")!.args[0]) as string;

    vi.resetModules();
    const altEnv = { ...prodEnv, RATELIMIT_HASH_SECRET: "b".repeat(64) };
    const { fakeRedis: r2 } = await importRateLimit(altEnv, "ok");
    const { checkRateLimit: rl2 } = await import("../lib/ratelimit/index");
    await rl2({ limitName: "n", key: "u@e.com", maxCount: 5, windowSeconds: 60, mode: "open" });
    const key2 = (r2.calls.find((c) => c.cmd === "incr")!.args[0]) as string;

    expect(key1).not.toBe(key2);
  });
});

// ---------------------------------------------------------------------------
// AC7 — no secret or clear email/IP in logs
// ---------------------------------------------------------------------------

describe("AC7: nothing sensitive in logs", () => {
  it("checkRateLimit module does not log clear email to console", async () => {
    vi.resetModules();
    const { mod } = await importRateLimit(devEnv, "ok");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await mod.checkRateLimit({ limitName: "test", key: "secret@email.com", maxCount: 5, windowSeconds: 60, mode: "open" });
    const allArgs = [...spy.mock.calls, ...errorSpy.mock.calls].flat().join(" ");
    expect(allArgs).not.toContain("secret@email.com");
    spy.mockRestore();
    errorSpy.mockRestore();
  });
});
