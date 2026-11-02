import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Supabase mock
// ---------------------------------------------------------------------------

const mockSignInWithPassword = vi.fn();
const mockGetUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { signInWithPassword: mockSignInWithPassword, getUser: mockGetUser },
  })),
}));

// ---------------------------------------------------------------------------
// Rate-limit mock — allow by default
// ---------------------------------------------------------------------------

const mockCheckRateLimit = vi.fn();

vi.mock("@/lib/ratelimit", () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}));

// ---------------------------------------------------------------------------
// client-ip mock
// ---------------------------------------------------------------------------

vi.mock("@/lib/ratelimit/client-ip", () => ({
  getClientIp: vi.fn(() => "1.2.3.4"),
}));

// ---------------------------------------------------------------------------
// cookies mock
// ---------------------------------------------------------------------------

const mockCookiesSet = vi.fn();
const mockCookiesGet = vi.fn();
const mockCookiesDelete = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    set: mockCookiesSet,
    get: mockCookiesGet,
    delete: mockCookiesDelete,
  })),
  headers: vi.fn(async () => new Headers()),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { signIn } from "@/lib/auth/actions/sign-in";

const VALID_INPUT = {
  email: "user@example.com",
  password: "correct-password",
  captchaToken: "token-abc",
};

beforeEach(() => {
  vi.clearAllMocks();
  // Default: all rate-limit checks pass
  mockCheckRateLimit.mockResolvedValue({ ok: true });
});

// ---------------------------------------------------------------------------
// AC1 — success path
// ---------------------------------------------------------------------------

describe("signIn — AC1 success", () => {
  it("returns ok:true with redirectTo on valid credentials", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: { id: "u1", email: "user@example.com" }, session: {} },
      error: null,
    });

    const result = await signIn({ ...VALID_INPUT, next: "/purchases" });

    expect(result).toEqual({ ok: true, redirectTo: "/purchases" });
  });

  it("redirectTo defaults to / when next is absent", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: { id: "u1", email: "user@example.com" }, session: {} },
      error: null,
    });

    const result = await signIn(VALID_INPUT);

    expect(result).toEqual({ ok: true, redirectTo: "/" });
  });

  it("safeNext rejects an external next URL, returns /", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: { id: "u1", email: "user@example.com" }, session: {} },
      error: null,
    });

    const result = await signIn({ ...VALID_INPUT, next: "https://evil.com" });

    expect(result).toEqual({ ok: true, redirectTo: "/" });
  });
});

// ---------------------------------------------------------------------------
// AC1 — wrong credentials (same error code for wrong email OR wrong password)
// ---------------------------------------------------------------------------

describe("signIn — AC1 wrong credentials", () => {
  it("returns invalid_credentials on wrong password", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "Invalid login credentials", status: 400 },
    });

    const result = await signIn(VALID_INPUT);

    expect(result).toEqual({ ok: false, code: "invalid_credentials" });
  });

  it("returns invalid_credentials on wrong email", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "Invalid login credentials", status: 400 },
    });

    const result = await signIn({ ...VALID_INPUT, email: "nobody@example.com" });

    expect(result).toEqual({ ok: false, code: "invalid_credentials" });
  });
});

// ---------------------------------------------------------------------------
// AC3 — email not verified
// ---------------------------------------------------------------------------

describe("signIn — AC3 email not verified", () => {
  it("returns invalid_credentials and stores pending email cookie when email unconfirmed", async () => {
    // Supabase returns "Email not confirmed" only when the password is correct.
    // We return invalid_credentials (not email_not_verified) to avoid account enumeration:
    // revealing email_not_verified would confirm both the email and the password (security §F-B).
    mockSignInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "Email not confirmed", status: 400 },
    });

    const result = await signIn(VALID_INPUT);

    expect(result).toEqual({ ok: false, code: "invalid_credentials" });
    // Must still set the pending_signup cookie so verify-email page has the address
    expect(mockCookiesSet).toHaveBeenCalledWith(
      "pending_signup",
      expect.stringContaining("user@example.com"),
      expect.objectContaining({ httpOnly: true })
    );
  });

  it("EC-missing-1: unverified account returns invalid_credentials regardless of password", async () => {
    // Supabase returns "Email not confirmed" only for a correct password, so the distinction
    // between right and wrong password is irrelevant here — both produce invalid_credentials.
    mockSignInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "Email not confirmed", status: 400 },
    });

    const result = await signIn(VALID_INPUT);
    expect(result).toEqual({ ok: false, code: "invalid_credentials" });
  });
});

// ---------------------------------------------------------------------------
// AC4 — suspended account
// ---------------------------------------------------------------------------

describe("signIn — AC4 suspended account", () => {
  it("returns account_suspended when Supabase returns a ban error", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "User is banned", status: 400 },
    });

    const result = await signIn(VALID_INPUT);

    expect(result).toEqual({ ok: false, code: "account_suspended" });
  });

  it("EC-missing-2: suspended account same code regardless of password correctness", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "User is banned", status: 403 },
    });

    const result = await signIn({ ...VALID_INPUT, password: "wrong-password" });

    expect(result).toEqual({ ok: false, code: "account_suspended" });
  });
});

// ---------------------------------------------------------------------------
// EC4 — Google-only user attempts password sign-in
// ---------------------------------------------------------------------------

describe("signIn — EC4 Google-only user", () => {
  it("returns invalid_credentials when a Google-only account has no password", async () => {
    // Supabase returns the same generic error for accounts with no password set.
    // This covers a user who registered via Google and never set a password.
    mockSignInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "Invalid login credentials", status: 400 },
    });

    const result = await signIn(VALID_INPUT);

    expect(result).toEqual({ ok: false, code: "invalid_credentials" });
  });
});

// ---------------------------------------------------------------------------
// AC2 — rate limits
// ---------------------------------------------------------------------------

// Rate limits are checked after a Supabase auth failure (AC2: "5 failures per 15 min").
// Each test must make signInWithPassword return an error first, then configure the tier.

describe("signIn — AC2 rate limits", () => {
  beforeEach(() => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "Invalid login credentials", status: 400 },
    });
  });

  it("returns rate_limited with retryAfterSeconds when composite email+IP limit hit", async () => {
    mockCheckRateLimit
      .mockResolvedValueOnce({ ok: false, reason: "rate_limited", retryAfterSeconds: 120 });

    const result = await signIn(VALID_INPUT);

    expect(result).toEqual({ ok: false, code: "rate_limited", retryAfterSeconds: 120 });
    expect(mockSignInWithPassword).toHaveBeenCalled();
  });

  it("returns rate_limited when per-IP hourly limit hit", async () => {
    mockCheckRateLimit
      .mockResolvedValueOnce({ ok: true }) // composite passes
      .mockResolvedValueOnce({ ok: false, reason: "rate_limited", retryAfterSeconds: 300 });

    const result = await signIn(VALID_INPUT);

    expect(result).toEqual({ ok: false, code: "rate_limited", retryAfterSeconds: 300 });
  });

  it("returns captcha_failed when per-email 30/hr tier is hit", async () => {
    mockCheckRateLimit
      .mockResolvedValueOnce({ ok: true }) // composite passes
      .mockResolvedValueOnce({ ok: true }) // per-IP passes
      .mockResolvedValueOnce({ ok: false, reason: "rate_limited", retryAfterSeconds: 60 }); // per-email

    const result = await signIn(VALID_INPUT);

    expect(result).toEqual({ ok: false, code: "captcha_failed" });
  });
});
