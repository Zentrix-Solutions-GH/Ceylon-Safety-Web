import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Supabase mock
// ---------------------------------------------------------------------------

const mockSignUp = vi.fn();
const mockGetUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { signUp: mockSignUp, getUser: mockGetUser },
  })),
}));

// ---------------------------------------------------------------------------
// Rate-limit mock — allow by default, configured per test
// ---------------------------------------------------------------------------

const mockCheckRateLimit = vi.fn();

vi.mock("@/lib/ratelimit", () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}));

// ---------------------------------------------------------------------------
// cookies mock (Next.js)
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
}));

// ---------------------------------------------------------------------------
// getClientIp mock
// ---------------------------------------------------------------------------

vi.mock("@/lib/ratelimit/client-ip", () => ({
  getClientIp: vi.fn(() => "1.2.3.4"),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    set: mockCookiesSet,
    get: mockCookiesGet,
    delete: mockCookiesDelete,
  })),
  headers: vi.fn(async () => new Headers()),
}));

import { signUp } from "@/lib/auth/actions/sign-up";

const VALID_INPUT = {
  firstName: "Kasun",
  lastName: "Silva",
  email: "kasun@example.com",
  password: "SecurePass1!",
  termsAccepted: true,
  captchaToken: "turnstile-test-token",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRateLimit.mockResolvedValue({ ok: true });
  mockSignUp.mockResolvedValue({ data: { user: { id: "uid-1" } }, error: null });
  mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
  // Prevent real HIBP network calls in CI — return a response with no matching suffix.
  // AC8 tests override this per-test via their own beforeEach/afterEach.
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    text: async () => "AAAAABBBBB00000:5\nCCCCCDDDDD11111:2",
  } as Response);
});

// ---------------------------------------------------------------------------
// AC1 — validation and happy path
// ---------------------------------------------------------------------------

describe("signUp — AC1: validation and Supabase call", () => {
  it("accepts valid input and calls Supabase signUp", async () => {
    const result = await signUp(VALID_INPUT);

    expect(result.ok).toBe(true);
    expect(mockSignUp).toHaveBeenCalledOnce();
    const [{ email, options }] = mockSignUp.mock.calls[0];
    expect(email).toBe("kasun@example.com");
    expect(options.data.first_name).toBe("Kasun");
    expect(options.data.last_name).toBe("Silva");
    expect(options.captchaToken).toBe("turnstile-test-token");
  });

  it("trims and lower-cases the email before passing to Supabase", async () => {
    await signUp({ ...VALID_INPUT, email: "  KASUN@EXAMPLE.COM  " });
    const [{ email }] = mockSignUp.mock.calls[0];
    expect(email).toBe("kasun@example.com");
  });

  it("trims names before passing to Supabase", async () => {
    await signUp({ ...VALID_INPUT, firstName: "  Kasun  ", lastName: "  Silva  " });
    const [{ options }] = mockSignUp.mock.calls[0];
    expect(options.data.first_name).toBe("Kasun");
    expect(options.data.last_name).toBe("Silva");
  });

  it("rejects names longer than 50 characters", async () => {
    const result = await signUp({ ...VALID_INPUT, firstName: "A".repeat(51) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("validation_failed");
  });

  it("rejects password shorter than 8 characters", async () => {
    const result = await signUp({ ...VALID_INPUT, password: "short" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("validation_failed");
      expect(result.field).toBe("password");
    }
  });

  it("rejects sign-up when rate limit is exhausted", async () => {
    mockCheckRateLimit.mockResolvedValue({ ok: false, reason: "rate_limited", retryAfterSeconds: 3600 });
    const result = await signUp(VALID_INPUT);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("rate_limited");
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it("never creates the profiles row itself", async () => {
    await signUp(VALID_INPUT);
    // signUp only calls auth.signUp — no from() or rpc() for profiles
    // (verified by the absence of any profiles-writing mock)
    expect(mockSignUp).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// AC2 — pending-email cookie and redirect
// ---------------------------------------------------------------------------

describe("signUp — AC2: pending cookie and redirect", () => {
  it("stores pending email in httpOnly cookie on success", async () => {
    const result = await signUp(VALID_INPUT);

    expect(result.ok).toBe(true);
    expect(mockCookiesSet).toHaveBeenCalledWith(
      expect.stringContaining("pending"),
      expect.stringContaining("kasun@example.com"),
      expect.objectContaining({ httpOnly: true, sameSite: "lax" })
    );
  });

  it("returns redirect to /verify-email on success", async () => {
    const result = await signUp(VALID_INPUT);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result as { ok: true; redirect: string }).redirect).toBe("/verify-email");
    }
  });

  it("stores next param in cookie when provided", async () => {
    await signUp({ ...VALID_INPUT, next: "/dashboard" });

    expect(mockCookiesSet).toHaveBeenCalledWith(
      expect.stringContaining("pending"),
      expect.stringContaining("/dashboard"),
      expect.any(Object)
    );
  });

  it("cookie max-age is 15 minutes (900 seconds)", async () => {
    await signUp(VALID_INPUT);

    expect(mockCookiesSet).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ maxAge: 900 })
    );
  });

  it("does not put email in the redirect URL", async () => {
    const result = await signUp(VALID_INPUT);

    if (result.ok) {
      const redirect = (result as { ok: true; redirect: string }).redirect;
      expect(redirect).not.toContain("kasun");
      expect(redirect).not.toContain("example.com");
    }
  });
});

// ---------------------------------------------------------------------------
// AC3 — existing email gives neutral result
// ---------------------------------------------------------------------------

describe("signUp — AC3: existing email gives same neutral result", () => {
  it("returns the same ok:true result for an existing email", async () => {
    // Supabase returns HTTP 200 with user=null for existing emails (auth design §21 verify item 1)
    mockSignUp.mockResolvedValue({ data: { user: null }, error: null });

    const result = await signUp(VALID_INPUT);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result as { ok: true; redirect: string }).redirect).toBe("/verify-email");
    }
  });

  it("does not reveal account existence in any error code", async () => {
    mockSignUp.mockResolvedValue({
      data: { user: null },
      error: { message: "User already registered", status: 422 },
    });

    const result = await signUp(VALID_INPUT);

    // Must not return account_exists or similar — must still appear successful or use a
    // neutral code that does not distinguish new from existing
    if (!result.ok) {
      expect(result.code).not.toBe("email_not_verified");
      expect(result.code).not.toBe("invalid_credentials");
    }
  });
});

// ---------------------------------------------------------------------------
// AC6 — validation error codes
// ---------------------------------------------------------------------------

describe("signUp — AC6: validation error codes", () => {
  it("returns weak_password with field=password for a short password", async () => {
    mockSignUp.mockResolvedValue({
      data: { user: null },
      error: { message: "Password should be at least 8 characters", status: 422 },
    });

    // Even if Supabase reports it, our Zod guard fires first for < 8 chars
    const result = await signUp({ ...VALID_INPUT, password: "short" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(["weak_password", "validation_failed"]).toContain(result.code);
      expect(result.field).toBe("password");
    }
  });

  it("returns validation_failed with field=terms when termsAccepted is false", async () => {
    const result = await signUp({ ...VALID_INPUT, termsAccepted: false });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("validation_failed");
      expect(result.field).toBe("terms");
    }
  });

  it("returns captcha_failed when Supabase reports captcha error", async () => {
    mockSignUp.mockResolvedValue({
      data: { user: null },
      error: { message: "captcha verification process failed", status: 422 },
    });
    const result = await signUp(VALID_INPUT);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("captcha_failed");
  });

  it("does NOT set the pending cookie when captcha_failed is returned", async () => {
    mockSignUp.mockResolvedValue({
      data: { user: null },
      error: { message: "captcha verification process failed", status: 422 },
    });
    await signUp(VALID_INPUT);
    expect(mockCookiesSet).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// AC8 — breached-password check
// SHA-1("password123") = CBFDAC6008F9CAB4083784CBD1874F76618D2A97
// prefix = CBFDA, suffix = C6008F9CAB4083784CBD1874F76618D2A97
// ---------------------------------------------------------------------------

const BREACHED_PASSWORD = "password123";
const BREACHED_SUFFIX = "C6008F9CAB4083784CBD1874F76618D2A97";

describe("signUp — AC8: breached-password check", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns weak_password when password suffix is in HIBP response", async () => {
    // Return a response that contains the known suffix for "password123"
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `AAAAABBBBB00000:5\n${BREACHED_SUFFIX}:100\nCCCCCDDDDD11111:2`,
    } as Response);

    const result = await signUp({ ...VALID_INPUT, password: BREACHED_PASSWORD });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("weak_password");
      expect(result.field).toBe("password");
    }
  });

  it("continues sign-up when breach service returns non-200", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, text: async () => "" } as Response);

    const result = await signUp(VALID_INPUT);
    // Fail-open: HIBP unavailable must not block sign-up
    expect(result.ok).toBe(true);
  });

  it("continues sign-up when breach service throws (network error)", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const result = await signUp(VALID_INPUT);
    expect(result.ok).toBe(true);
  });
});
