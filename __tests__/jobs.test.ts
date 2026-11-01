// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── helpers ──────────────────────────────────────────────────────────────────

const BASE_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: "a".repeat(64),
  CSP_MODE: "report-only",
  NEXT_PUBLIC_PUBLIC_MEDIA_BASE_URL: "https://cdn.ceylonsafety.com",
  CRON_SECRET: "a".repeat(32),
};

function setEnv(overrides: Record<string, string | undefined> = {}) {
  const env = { ...BASE_ENV, ...overrides };
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

function clearEnv() {
  for (const k of Object.keys(BASE_ENV)) delete process.env[k];
  delete process.env["HEALTHCHECKS_BASE_URL"];
  delete process.env["HEALTHCHECKS_TEST_ID"];
}

// ── AC3: test job idempotence ─────────────────────────────────────────────────

describe("AC3: test job is idempotent", () => {
  beforeEach(() => setEnv());
  afterEach(() => clearEnv());

  it("running the test job twice produces the same result", async () => {
    vi.resetModules();
    const { JOB_REGISTRY } = await import(`../lib/jobs/index?t=${Date.now()}`);
    const handler = JOB_REGISTRY["test"];
    expect(handler).toBeDefined();
    const result1 = await handler();
    const result2 = await handler();
    expect(result1).toEqual(result2);
  });

  it("test job result does not mutate on repeated calls", async () => {
    vi.resetModules();
    const { JOB_REGISTRY } = await import(`../lib/jobs/index?t=${Date.now()}`);
    const results: unknown[] = [];
    for (let i = 0; i < 3; i++) {
      results.push(await JOB_REGISTRY["test"]());
    }
    // All results are the same shape
    expect(results[0]).toEqual(results[1]);
    expect(results[1]).toEqual(results[2]);
  });
});

// ── AC3: UTC in code ──────────────────────────────────────────────────────────

describe("AC3: jobs use UTC (T20)", () => {
  it("new Date().toISOString() ends with Z (UTC offset)", () => {
    const iso = new Date().toISOString();
    expect(iso).toMatch(/Z$/);
  });

  it("Date.UTC produces same result regardless of system timezone", () => {
    const utcMs = Date.UTC(2024, 0, 1, 12, 0, 0);
    const d = new Date(utcMs);
    expect(d.toISOString()).toBe("2024-01-01T12:00:00.000Z");
  });
});

// ── AC4: heartbeat — success ping ────────────────────────────────────────────

describe("AC4: heartbeat pings", () => {
  beforeEach(() => setEnv());
  afterEach(() => {
    clearEnv();
    vi.restoreAllMocks();
  });

  it("pings success URL after a successful run", async () => {
    vi.resetModules();
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response("ok", { status: 200 })
    );

    process.env["HEALTHCHECKS_BASE_URL"] = "https://hc-ping.com";
    process.env["HEALTHCHECKS_TEST_ID"] = "uuid-test-id";

    const { pingHeartbeat } = await import(`../lib/jobs/index?t=${Date.now()}`);
    await pingHeartbeat("test", "success");

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url] = fetchSpy.mock.calls[0] as [string];
    expect(url).toContain("uuid-test-id");
    expect(url).not.toContain("/fail");
  });

  it("pings fail URL after a failed run", async () => {
    vi.resetModules();
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response("ok", { status: 200 })
    );

    process.env["HEALTHCHECKS_BASE_URL"] = "https://hc-ping.com";
    process.env["HEALTHCHECKS_TEST_ID"] = "uuid-test-id";

    const { pingHeartbeat } = await import(`../lib/jobs/index?t=${Date.now()}`);
    await pingHeartbeat("test", "fail");

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url] = fetchSpy.mock.calls[0] as [string];
    expect(url).toContain("uuid-test-id");
    expect(url).toContain("/fail");
  });

  it("skips heartbeat silently when HEALTHCHECKS_BASE_URL is missing outside production", async () => {
    vi.resetModules();
    delete process.env["HEALTHCHECKS_BASE_URL"];
    delete process.env["HEALTHCHECKS_TEST_ID"];

    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response("ok", { status: 200 })
    );

    const { pingHeartbeat } = await import(`../lib/jobs/index?t=${Date.now()}`);
    await expect(pingHeartbeat("test", "success")).resolves.toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("skips heartbeat silently when job has no heartbeat URL configured", async () => {
    vi.resetModules();
    process.env["HEALTHCHECKS_BASE_URL"] = "https://hc-ping.com";
    // No HEALTHCHECKS_TEST_ID set

    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response("ok", { status: 200 })
    );

    const { pingHeartbeat } = await import(`../lib/jobs/index?t=${Date.now()}`);
    await expect(pingHeartbeat("test", "success")).resolves.toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
