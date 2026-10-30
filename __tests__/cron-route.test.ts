// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── helpers ──────────────────────────────────────────────────────────────────

function makeRequest(method: string, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/cron/test", {
    method,
    headers,
  });
}

const VALID_SECRET = "a".repeat(32);
const VALID_ENV = {
  CRON_SECRET: VALID_SECRET,
  NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: "a".repeat(64),
  CSP_MODE: "report-only",
  NEXT_PUBLIC_PUBLIC_MEDIA_BASE_URL: "https://cdn.ceylonsafety.com",
};

function setEnv(overrides: Record<string, string | undefined> = {}) {
  const env = { ...VALID_ENV, ...overrides };
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

function clearEnv() {
  for (const k of Object.keys(VALID_ENV)) delete process.env[k];
}

async function importRoute() {
  vi.resetModules();
  return import(`../app/api/cron/[job]/route?t=${Date.now()}`);
}

// ── AC1: method check ────────────────────────────────────────────────────────

describe("AC1: GET returns 405", () => {
  beforeEach(() => setEnv());
  afterEach(() => clearEnv());

  it("returns 405 for GET", async () => {
    const { GET } = await importRoute();
    expect(GET).toBeDefined();
    const res: Response = await GET(makeRequest("GET"), { params: Promise.resolve({ job: "test" }) });
    expect(res.status).toBe(405);
  });
});

// ── AC1: secret check ────────────────────────────────────────────────────────

describe("AC1: secret header validation", () => {
  beforeEach(() => setEnv());
  afterEach(() => clearEnv());

  it("returns 401 when x-cron-secret header is missing", async () => {
    const { POST } = await importRoute();
    const res: Response = await POST(makeRequest("POST"), { params: Promise.resolve({ job: "test" }) });
    expect(res.status).toBe(401);
  });

  it("returns 401 when x-cron-secret is wrong", async () => {
    const { POST } = await importRoute();
    const res: Response = await POST(
      makeRequest("POST", { "x-cron-secret": "wrong-secret" }),
      { params: Promise.resolve({ job: "test" }) }
    );
    expect(res.status).toBe(401);
  });

  it("returns 401 when x-cron-secret is empty string", async () => {
    const { POST } = await importRoute();
    const res: Response = await POST(
      makeRequest("POST", { "x-cron-secret": "" }),
      { params: Promise.resolve({ job: "test" }) }
    );
    expect(res.status).toBe(401);
  });

  it("returns 200 with { ok: true } body and logs duration when secret matches", async () => {
    vi.resetModules();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    setEnv();
    const { POST } = await import(`../app/api/cron/[job]/route?t=${Date.now()}`);
    const res: Response = await POST(
      makeRequest("POST", { "x-cron-secret": VALID_SECRET }),
      { params: Promise.resolve({ job: "test" }) }
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    // EC5: framework must log duration
    const logLine = logSpy.mock.calls.flat().join(" ");
    expect(logLine).toMatch(/duration=\d+ms/);
    expect(logLine).not.toContain(VALID_SECRET);
    logSpy.mockRestore();
  });

  it("does not reveal details in 401 body", async () => {
    const { POST } = await importRoute();
    const res: Response = await POST(makeRequest("POST"), { params: Promise.resolve({ job: "test" }) });
    expect(res.status).toBe(401);
    const body = await res.text();
    expect(body).not.toContain(VALID_SECRET);
    expect(body.length).toBeLessThan(50); // no detail
  });
});

// ── EC2: no extra trimming in application code ────────────────────────────────
// HTTP spec (fetch Headers) strips leading/trailing whitespace from header values
// before they reach application code. EC2's intent is that the route does NOT add
// a .trim() call that would allow a padded secret to match. Since the HTTP layer
// already normalises values, we test the case that still fails: internal whitespace
// and completely different values.

describe("EC2: application code does not add extra trimming", () => {
  beforeEach(() => setEnv());
  afterEach(() => clearEnv());

  it("returns 401 when header contains internal whitespace (cannot trim to match)", async () => {
    const { POST } = await importRoute();
    const res: Response = await POST(
      makeRequest("POST", { "x-cron-secret": VALID_SECRET.slice(0, 16) + " " + VALID_SECRET.slice(16) }),
      { params: Promise.resolve({ job: "test" }) }
    );
    expect(res.status).toBe(401);
  });

  it("returns 401 for a completely different value", async () => {
    const { POST } = await importRoute();
    const res: Response = await POST(
      makeRequest("POST", { "x-cron-secret": "not-the-right-secret" }),
      { params: Promise.resolve({ job: "test" }) }
    );
    expect(res.status).toBe(401);
  });
});

// ── AC1: constant-time compare ───────────────────────────────────────────────

describe("AC1: constant-time compare helper", () => {
  it("timingSafeEqual returns true for equal strings", async () => {
    vi.resetModules();
    const { timingSafeStringEqual } = await import(`../lib/jobs/index?t=${Date.now()}`);
    expect(timingSafeStringEqual("abc", "abc")).toBe(true);
  });

  it("timingSafeEqual returns false for unequal strings of same length", async () => {
    vi.resetModules();
    const { timingSafeStringEqual } = await import(`../lib/jobs/index?t=${Date.now()}`);
    expect(timingSafeStringEqual("abc", "abd")).toBe(false);
  });

  it("timingSafeEqual returns false for different-length strings", async () => {
    vi.resetModules();
    const { timingSafeStringEqual } = await import(`../lib/jobs/index?t=${Date.now()}`);
    expect(timingSafeStringEqual("abc", "abcd")).toBe(false);
  });
});

// ── AC2: unknown job name → 404 (after auth) ─────────────────────────────────

describe("AC2: unknown job returns 404", () => {
  beforeEach(() => setEnv());
  afterEach(() => clearEnv());

  it("returns 404 for unknown job after valid secret", async () => {
    const { POST } = await importRoute();
    const res: Response = await POST(
      makeRequest("POST", { "x-cron-secret": VALID_SECRET }),
      { params: Promise.resolve({ job: "nonexistent-job" }) }
    );
    expect(res.status).toBe(404);
  });

  it("returns 401 (not 404) for unknown job with wrong secret", async () => {
    const { POST } = await importRoute();
    const res: Response = await POST(
      makeRequest("POST", { "x-cron-secret": "wrong" }),
      { params: Promise.resolve({ job: "nonexistent-job" }) }
    );
    expect(res.status).toBe(401);
  });
});

// ── AC2: handler error → 500, redacted log ───────────────────────────────────

describe("AC2: handler error returns 500", () => {
  beforeEach(() => setEnv());
  afterEach(() => clearEnv());

  it("returns 500 when a job handler throws, logs duration, never logs the secret", async () => {
    vi.resetModules();
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // Register a failing job by mocking the jobs module
    vi.doMock("../lib/jobs/index", async (importOriginal) => {
      const original = await importOriginal<typeof import("../lib/jobs/index")>();
      return {
        ...original,
        JOB_REGISTRY: {
          ...original.JOB_REGISTRY,
          "fail-job": async () => { throw new Error("handler exploded"); },
        },
      };
    });
    const { POST } = await import(`../app/api/cron/[job]/route?t=${Date.now()}`);
    const res: Response = await POST(
      makeRequest("POST", { "x-cron-secret": VALID_SECRET }),
      { params: Promise.resolve({ job: "fail-job" }) }
    );
    expect(res.status).toBe(500);
    // EC5: duration logged on error path
    const errLine = errSpy.mock.calls.flat().join(" ");
    expect(errLine).toMatch(/duration=\d+ms/);
    // EC1: secret never appears in the error log
    expect(errLine).not.toContain(VALID_SECRET);
    errSpy.mockRestore();
  });
});

// ── EC1: secret must not appear in logs or responses ─────────────────────────

describe("EC1: secret not echoed", () => {
  beforeEach(() => setEnv());
  afterEach(() => clearEnv());

  it("401 response body does not contain the secret", async () => {
    const { POST } = await importRoute();
    const res: Response = await POST(
      makeRequest("POST", { "x-cron-secret": "wrong-secret-that-is-logged" }),
      { params: Promise.resolve({ job: "test" }) }
    );
    const body = await res.text();
    expect(body).not.toContain("wrong-secret-that-is-logged");
  });

  it("404 response body does not contain the secret", async () => {
    const { POST } = await importRoute();
    const res: Response = await POST(
      makeRequest("POST", { "x-cron-secret": VALID_SECRET }),
      { params: Promise.resolve({ job: "unknown" }) }
    );
    const body = await res.text();
    expect(body).not.toContain(VALID_SECRET);
  });
});
