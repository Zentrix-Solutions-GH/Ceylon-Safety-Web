// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockGetUser = vi.fn();
const mockSignOut = vi.fn().mockResolvedValue({ error: null });
const mockGetAAL = vi.fn().mockResolvedValue({
  data: { currentLevel: "aal2" },
  error: null,
});

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
      signOut: mockSignOut,
      mfa: { getAuthenticatorAssuranceLevel: mockGetAAL },
    },
  })),
}));

vi.mock("@/lib/ratelimit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("@/lib/ratelimit/client-ip", () => ({
  getClientIp: vi.fn().mockReturnValue("1.2.3.4"),
}));

// Import after mocks
import middleware, { config } from "../middleware";
import { checkRateLimit as _checkRateLimit } from "@/lib/ratelimit";

const mockCheckRateLimit = vi.mocked(_checkRateLimit);

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(
  path: string,
  options: { cookies?: Record<string, string>; ip?: string } = {}
): NextRequest {
  const url = `https://ceylonsafety.com${path}`;
  const req = new NextRequest(url);
  if (options.cookies) {
    for (const [name, value] of Object.entries(options.cookies)) {
      req.cookies.set(name, value);
    }
  }
  if (options.ip) {
    Object.defineProperty(req, "headers", {
      value: new Headers({
        ...Object.fromEntries(req.headers.entries()),
        "x-forwarded-for": options.ip,
      }),
      writable: false,
    });
  }
  return req;
}

function noUser() {
  mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
}

function activeUser(role?: string, status = "active") {
  mockGetUser.mockResolvedValue({
    data: {
      user: {
        id: "u1",
        email: "u@example.com",
        app_metadata: {
          ...(role ? { user_role: role } : {}),
          account_status: status,
        },
        factors: [],
      },
    },
    error: null,
  });
}

function suspendedUser() {
  mockGetUser.mockResolvedValue({
    data: {
      user: {
        id: "u2",
        email: "suspended@example.com",
        app_metadata: { account_status: "suspended" },
        factors: [],
      },
    },
    error: null,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRateLimit.mockResolvedValue({ ok: true });
  mockSignOut.mockResolvedValue({ error: null });
  mockGetAAL.mockResolvedValue({ data: { currentLevel: "aal2" }, error: null });
  process.env["NEXT_PUBLIC_SUPABASE_URL"] = "https://test.supabase.co";
  process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"] = "anon";
});

// ── AC1: Matcher ─────────────────────────────────────────────────────────────

describe("AC1 — matcher", () => {
  const EXPECTED_PATHS = [
    "/admin/:path*",
    "/cart",
    "/checkout/:path*",
    "/download/:path*",
    "/purchases/:path*",
    "/profile/:path*",
    "/sign-in",
    "/sign-up",
    "/forgot-password",
    "/verify-email",
    "/reset-password",
    "/api/:path*",
  ];

  it("exports a config.matcher covering exactly the required paths", () => {
    expect(config.matcher).toEqual(expect.arrayContaining(EXPECTED_PATHS));
    expect(config.matcher).toHaveLength(EXPECTED_PATHS.length);
  });

  it("does not include catch-all patterns that would run on public pages", () => {
    const hasCatchAll = config.matcher.some(
      (p: string) => p === "(.*)" || p === "/:path*" || p === "/"
    );
    expect(hasCatchAll).toBe(false);
  });
});

// ── AC2: Coarse rate limit for /api/* ────────────────────────────────────────

describe("AC2 — rate limit", () => {
  it("applies the rate limit to /api/feed", async () => {
    noUser();
    await middleware(makeRequest("/api/feed", { ip: "1.2.3.4" }));
    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ key: "1.2.3.4", limitName: "api_coarse" })
    );
  });

  it("returns 429 when limited", async () => {
    noUser();
    mockCheckRateLimit.mockResolvedValue({ ok: false, reason: "rate_limited" as const });
    const res = await middleware(makeRequest("/api/feed"));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
  });

  it("does not apply the rate limit to /api/payhere/notify", async () => {
    noUser();
    await middleware(makeRequest("/api/payhere/notify"));
    expect(mockCheckRateLimit).not.toHaveBeenCalled();
  });

  it("does not apply the rate limit to /api/cron/daily", async () => {
    noUser();
    await middleware(makeRequest("/api/cron/daily"));
    expect(mockCheckRateLimit).not.toHaveBeenCalled();
  });

  it("does not apply the rate limit to /api/auth/callback", async () => {
    noUser();
    await middleware(makeRequest("/api/auth/callback"));
    expect(mockCheckRateLimit).not.toHaveBeenCalled();
  });

  it("does not verify the session for /api/* routes (AC7)", async () => {
    noUser();
    await middleware(makeRequest("/api/search"));
    expect(mockGetUser).not.toHaveBeenCalled();
  });
});

// ── AC3: Guest-only redirect ──────────────────────────────────────────────────

describe("AC3 — guest-only redirect", () => {
  const GUEST_ONLY_PATHS = ["/sign-in", "/sign-up", "/forgot-password", "/verify-email"];

  for (const path of GUEST_ONLY_PATHS) {
    it(`redirects a signed-in user from ${path} to /`, async () => {
      activeUser();
      const res = await middleware(makeRequest(path));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("https://ceylonsafety.com/");
    });

    it(`allows a visitor to reach ${path}`, async () => {
      noUser();
      const res = await middleware(makeRequest(path));
      expect(res.status).toBe(200);
    });
  }

  it("does NOT redirect a signed-in user from /reset-password", async () => {
    activeUser();
    const res = await middleware(makeRequest("/reset-password"));
    expect(res.status).not.toBe(307);
  });
});

// ── AC4: Customer route protection ───────────────────────────────────────────

describe("AC4 — customer route protection", () => {
  const CUSTOMER_PATHS = [
    "/cart",
    "/checkout",
    "/checkout/payment",
    "/purchases",
    "/profile",
    "/download",
    "/download/abc123",
  ];

  for (const path of CUSTOMER_PATHS) {
    it(`redirects unauthenticated visitor from ${path} to /sign-in`, async () => {
      noUser();
      const res = await middleware(makeRequest(path));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/sign-in");
    });

    it(`sets the next cookie when redirecting from ${path}`, async () => {
      noUser();
      const res = await middleware(makeRequest(path));
      const cookie = res.cookies.get("next");
      expect(cookie).toBeDefined();
      expect(cookie?.value).toBe(path);
    });
  }

  it("next cookie is HttpOnly", async () => {
    noUser();
    const res = await middleware(makeRequest("/cart"));
    const setCookieHeader = res.headers.get("set-cookie") ?? "";
    expect(setCookieHeader.toLowerCase()).toContain("httponly");
  });

  it("next cookie is SameSite=Lax", async () => {
    noUser();
    const res = await middleware(makeRequest("/cart"));
    const setCookieHeader = res.headers.get("set-cookie") ?? "";
    expect(setCookieHeader.toLowerCase()).toContain("samesite=lax");
  });

  it("allows an active signed-in user to reach /cart", async () => {
    activeUser();
    const res = await middleware(makeRequest("/cart"));
    expect(res.status).toBe(200);
  });

  it("redirects a suspended user to /suspended", async () => {
    suspendedUser();
    const res = await middleware(makeRequest("/cart"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/suspended");
  });

  it("calls signOut for a suspended user", async () => {
    suspendedUser();
    await middleware(makeRequest("/cart"));
    expect(mockSignOut).toHaveBeenCalled();
  });
});

// ── EC2: Hostile next cookie ──────────────────────────────────────────────────

describe("EC2 — hostile next cookie value", () => {
  it("stores only the request pathname in the next cookie (no query string)", async () => {
    noUser();
    const res = await middleware(makeRequest("/cart?foo=bar"));
    const cookie = res.cookies.get("next");
    expect(cookie?.value).toBe("/cart");
    // Must be a relative path without query string
    expect(cookie?.value).not.toMatch(/^https?:\/\//);
    expect(cookie?.value).not.toContain("?");
  });
});

// ── AC6: Private headers ──────────────────────────────────────────────────────

describe("AC6 — Cache-Control and X-Robots-Tag headers", () => {
  const PRIVATE_PATHS = [
    "/sign-in",
    "/cart",
    "/checkout/payment",
    "/profile",
    "/admin/dashboard",
    "/reset-password",
    "/forgot-password",
    "/sign-up",
    "/verify-email",
  ];

  for (const path of PRIVATE_PATHS) {
    it(`sets Cache-Control: no-store on ${path}`, async () => {
      noUser(); // guest — still gets the header
      const res = await middleware(makeRequest(path));
      expect(res.headers.get("Cache-Control")).toBe("no-store");
    });

    it(`sets X-Robots-Tag: noindex on ${path}`, async () => {
      noUser();
      const res = await middleware(makeRequest(path));
      expect(res.headers.get("X-Robots-Tag")).toMatch(/noindex/);
    });
  }

  it("sets Cache-Control: no-store on the redirect response for an unauthenticated customer", async () => {
    noUser();
    const res = await middleware(makeRequest("/cart"));
    // Redirect response (307) must still carry the header
    expect(res.status).toBe(307);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("does not set Cache-Control on an API route", async () => {
    noUser();
    const res = await middleware(makeRequest("/api/feed"));
    // API routes just pass through or return 429; no page headers
    expect(res.headers.get("Cache-Control")).not.toBe("no-store");
  });
});
