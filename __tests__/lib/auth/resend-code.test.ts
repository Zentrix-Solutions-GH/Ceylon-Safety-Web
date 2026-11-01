import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Supabase mock
// ---------------------------------------------------------------------------

const mockResend = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { resend: mockResend },
  })),
}));

// ---------------------------------------------------------------------------
// Rate-limit mock
// ---------------------------------------------------------------------------

const mockCheckRateLimit = vi.fn();

vi.mock("@/lib/ratelimit", () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}));

// ---------------------------------------------------------------------------
// Attempt counter mock
// ---------------------------------------------------------------------------

const mockResetAttempts = vi.fn();

vi.mock("@/lib/auth/attempt-counter", () => ({
  getAttempts: vi.fn().mockResolvedValue(0),
  incAttempts: vi.fn().mockResolvedValue(1),
  resetAttempts: (...args: unknown[]) => mockResetAttempts(...args),
}));

// ---------------------------------------------------------------------------
// Cookies mock
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

import { resendCode } from "@/lib/auth/actions/resend-code";

const VALID_INPUT = { email: "kasun@example.com", captchaToken: "turnstile-token" };

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRateLimit.mockResolvedValue({ ok: true });
  mockResend.mockResolvedValue({ data: {}, error: null });
  mockResetAttempts.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// AC5 — happy path
// ---------------------------------------------------------------------------

describe("resendCode — AC5: happy path", () => {
  it("calls Supabase resend with type=signup and email", async () => {
    const result = await resendCode(VALID_INPUT);
    expect(result.ok).toBe(true);
    expect(mockResend).toHaveBeenCalledWith(
      expect.objectContaining({ type: "signup", email: "kasun@example.com" })
    );
  });

  it("resets the wrong-attempt counter when a new code is sent", async () => {
    await resendCode(VALID_INPUT);
    expect(mockResetAttempts).toHaveBeenCalledWith("kasun@example.com");
  });

  it("normalises email (trim + lowercase) before rate-limit and Supabase call", async () => {
    await resendCode({ ...VALID_INPUT, email: "  KASUN@EXAMPLE.COM  " });
    expect(mockResend).toHaveBeenCalledWith(
      expect.objectContaining({ email: "kasun@example.com" })
    );
  });
});

// ---------------------------------------------------------------------------
// AC5 — 60-second cooldown (EC4)
// ---------------------------------------------------------------------------

describe("resendCode — AC5/EC4: 60-second cooldown", () => {
  it("returns rate_limited with reason=cooldown when within 60 seconds", async () => {
    mockCheckRateLimit.mockImplementation(async (opts: { limitName: string }) => {
      if (opts.limitName === "resend_cooldown") {
        return { ok: false, reason: "rate_limited", retryAfterSeconds: 45 };
      }
      return { ok: true };
    });

    const result = await resendCode(VALID_INPUT);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("rate_limited");
      expect((result as { ok: false; code: string; reason?: string }).reason).toBe("cooldown");
    }
    expect(mockResend).not.toHaveBeenCalled();
  });

  it("returns rate_limited with reason=hourly when hourly cap is hit", async () => {
    mockCheckRateLimit.mockImplementation(async (opts: { limitName: string }) => {
      if (opts.limitName === "resend_hourly") {
        return { ok: false, reason: "rate_limited", retryAfterSeconds: 3000 };
      }
      return { ok: true };
    });

    const result = await resendCode(VALID_INPUT);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("rate_limited");
      expect((result as { ok: false; code: string; reason?: string }).reason).toBe("hourly");
    }
  });

  it("includes retryAfterSeconds in the rate_limited result", async () => {
    mockCheckRateLimit.mockResolvedValue({ ok: false, reason: "rate_limited", retryAfterSeconds: 45 });

    const result = await resendCode(VALID_INPUT);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect((result as { ok: false; retryAfterSeconds?: number }).retryAfterSeconds).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Unknown email — neutral result
// ---------------------------------------------------------------------------

describe("resendCode — neutral result for unknown email", () => {
  it("returns ok:true for an email that was never signed up", async () => {
    // Supabase may return an error; the action must return a neutral success to not reveal account status
    mockResend.mockResolvedValue({
      data: {},
      error: { message: "User not found", status: 404 },
    });

    const result = await resendCode(VALID_INPUT);
    expect(result.ok).toBe(true);
  });
});
