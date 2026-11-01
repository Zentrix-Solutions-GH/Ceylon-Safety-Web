// @vitest-environment node
// AC5: Route-access matrix — every route class × every user kind
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
  checkRateLimit: vi.fn().mockResolvedValue({ limited: false }),
}));

import middleware from "../middleware";

// ── User factories ────────────────────────────────────────────────────────────

function noUser() {
  mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
}

function customer() {
  mockGetUser.mockResolvedValue({
    data: {
      user: {
        id: "c1",
        email: "c@example.com",
        app_metadata: { account_status: "active" },
        amr: [{ method: "password", timestamp: Math.floor(Date.now() / 1000) }],
        factors: [],
      },
    },
    error: null,
  });
}

function suspended() {
  mockGetUser.mockResolvedValue({
    data: {
      user: {
        id: "s1",
        email: "s@example.com",
        app_metadata: { account_status: "suspended" },
        amr: [],
        factors: [],
      },
    },
    error: null,
  });
}

function staffUser(
  role: "super_admin" | "admin" | "maintainer",
  { totpEnrolled = true, totpInSession = true } = {}
) {
  mockGetUser.mockResolvedValue({
    data: {
      user: {
        id: "staff1",
        email: "staff@example.com",
        app_metadata: { user_role: role, account_status: "active" },
        factors: totpEnrolled ? [{ factor_type: "totp", status: "verified" }] : [],
      },
    },
    error: null,
  });
  // AAL2 only when TOTP has been verified in this session
  mockGetAAL.mockResolvedValue({
    data: { currentLevel: totpInSession ? "aal2" : "aal1" },
    error: null,
  });
}

function req(path: string): NextRequest {
  return new NextRequest(`https://ceylonsafety.com${path}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAAL.mockResolvedValue({ data: { currentLevel: "aal2" }, error: null });
  process.env["NEXT_PUBLIC_SUPABASE_URL"] = "https://test.supabase.co";
  process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"] = "anon";
});

// ── AC5: Admin routes ─────────────────────────────────────────────────────────

describe("AC5 — /admin/** route matrix", () => {
  it("visitor → redirect to /sign-in", async () => {
    noUser();
    const res = await middleware(req("/admin/dashboard"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/sign-in");
  });

  it("customer → 404 (not found, do not reveal admin exists)", async () => {
    customer();
    const res = await middleware(req("/admin/dashboard"));
    expect(res.status).toBe(404);
  });

  it("maintainer → 404 (no panel access by default, ASSUMPTION accepted)", async () => {
    staffUser("maintainer");
    const res = await middleware(req("/admin/dashboard"));
    expect(res.status).toBe(404);
  });

  it("suspended user (no staff claim) → 404", async () => {
    suspended();
    const res = await middleware(req("/admin/dashboard"));
    // Suspended has no staff claim → 404
    expect(res.status).toBe(404);
  });

  it("suspended staff → sign out and redirect to /suspended", async () => {
    // A staff user whose account_status is suspended in JWT claims
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "staff2",
          email: "staff@example.com",
          app_metadata: { user_role: "admin", account_status: "suspended" },
          factors: [{ factor_type: "totp", status: "verified" }],
        },
      },
      error: null,
    });
    const res = await middleware(req("/admin/dashboard"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/suspended");
    expect(mockSignOut).toHaveBeenCalled();
  });

  it("admin with TOTP enrolled and in session → 200", async () => {
    staffUser("admin");
    const res = await middleware(req("/admin/dashboard"));
    expect(res.status).toBe(200);
  });

  it("super_admin with TOTP enrolled and in session → 200", async () => {
    staffUser("super_admin");
    const res = await middleware(req("/admin/dashboard"));
    expect(res.status).toBe(200);
  });

  it("admin without TOTP enrolled → redirect to /admin/security", async () => {
    staffUser("admin", { totpEnrolled: false, totpInSession: false });
    const res = await middleware(req("/admin/dashboard"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/admin/security");
  });

  it("admin with TOTP enrolled but not in session → redirect to /admin/mfa", async () => {
    staffUser("admin", { totpEnrolled: true, totpInSession: false });
    const res = await middleware(req("/admin/dashboard"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/admin/mfa");
  });
});

// ── EC3: /admin with customer claim → 404 not 403 ────────────────────────────

describe("EC3 — customer accessing /admin returns 404 not 403", () => {
  it("customer gets 404 on /admin", async () => {
    customer();
    const res = await middleware(req("/admin"));
    expect(res.status).toBe(404);
    // Must not be 403 (which would reveal the route exists)
    expect(res.status).not.toBe(403);
  });
});

// ── EC4: /admin/security and /admin/mfa no redirect loop ─────────────────────

describe("EC4 — /admin/security and /admin/mfa no redirect loop", () => {
  it("admin without TOTP can reach /admin/security without looping", async () => {
    staffUser("admin", { totpEnrolled: false, totpInSession: false });
    const res = await middleware(req("/admin/security"));
    expect(res.status).toBe(200);
  });

  it("admin without TOTP in session can reach /admin/mfa without looping", async () => {
    staffUser("admin", { totpEnrolled: true, totpInSession: false });
    const res = await middleware(req("/admin/mfa"));
    expect(res.status).toBe(200);
  });

  it("admin without TOTP enrolled can still reach /admin/mfa", async () => {
    staffUser("admin", { totpEnrolled: false, totpInSession: false });
    const res = await middleware(req("/admin/mfa"));
    expect(res.status).toBe(200);
  });
});

// ── /admin/system/** — super_admin only ──────────────────────────────────────

describe("AC5 — /admin/system/** super_admin only", () => {
  it("super_admin can reach /admin/system/settings", async () => {
    staffUser("super_admin");
    const res = await middleware(req("/admin/system/settings"));
    expect(res.status).toBe(200);
  });

  it("admin gets 404 on /admin/system", async () => {
    staffUser("admin");
    const res = await middleware(req("/admin/system"));
    expect(res.status).toBe(404);
  });

  it("admin gets 404 on /admin/system/settings", async () => {
    staffUser("admin");
    const res = await middleware(req("/admin/system/settings"));
    expect(res.status).toBe(404);
  });

  it("visitor gets redirect (not 404) on /admin/system", async () => {
    noUser();
    const res = await middleware(req("/admin/system"));
    expect(res.status).toBe(307);
  });
});

// ── EC5: /api/payhere/notify repeated retries never rate limited ──────────────

describe("EC5 — /api/payhere/notify never rate limited", () => {
  it("does not call checkRateLimit for /api/payhere/notify", async () => {
    const { checkRateLimit } = await import("@/lib/ratelimit");
    const spy = vi.mocked(checkRateLimit);
    spy.mockResolvedValue({ limited: true }); // would rate-limit if called
    const res = await middleware(req("/api/payhere/notify"));
    expect(spy).not.toHaveBeenCalled();
    expect(res.status).not.toBe(429);
  });
});
