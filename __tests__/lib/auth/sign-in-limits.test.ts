import { describe, it, expect, vi, beforeEach } from "vitest";

// Tests for AC2: the three rate-limit tiers on signIn.
// Rate limits are checked AFTER a Supabase auth failure so that successful
// sign-ins do not consume the "failures" quota (AC2: "5 failures per 15 min").

const mockCheckRateLimit = vi.fn();
const mockSignInWithPassword = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { signInWithPassword: mockSignInWithPassword },
  })),
}));

vi.mock("@/lib/ratelimit", () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}));

vi.mock("@/lib/ratelimit/client-ip", () => ({
  getClientIp: vi.fn(() => "10.0.0.1"),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ set: vi.fn(), get: vi.fn(), delete: vi.fn() })),
  headers: vi.fn(async () => new Headers()),
}));

import { signIn } from "@/lib/auth/actions/sign-in";

const INPUT = { email: "a@b.com", password: "pw", captchaToken: "t" };

const AUTH_ERROR = {
  data: { user: null, session: null },
  error: { message: "Invalid login credentials", status: 400 },
};

beforeEach(() => {
  vi.clearAllMocks();
  // Default: all rate-limit checks pass
  mockCheckRateLimit.mockResolvedValue({ ok: true });
});

describe("signIn rate-limit tiers — AC2", () => {
  it("calls checkRateLimit three times in the correct order on auth failure", async () => {
    mockSignInWithPassword.mockResolvedValue(AUTH_ERROR);
    await signIn(INPUT);
    expect(mockCheckRateLimit).toHaveBeenCalledTimes(3);
    // First call: composite email+IP (5/15 min, closed)
    expect(mockCheckRateLimit).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ limitName: "signin-composite", maxCount: 5, windowSeconds: 900 })
    );
    // Second call: per-IP (20/hr, closed)
    expect(mockCheckRateLimit).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ limitName: "signin-ip", maxCount: 20, windowSeconds: 3600 })
    );
    // Third call: per-email (30/hr, open)
    expect(mockCheckRateLimit).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ limitName: "signin-email", maxCount: 30, windowSeconds: 3600 })
    );
  });

  it("does not call checkRateLimit on successful sign-in", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: { id: "u1" }, session: {} },
      error: null,
    });
    await signIn(INPUT);
    expect(mockCheckRateLimit).not.toHaveBeenCalled();
  });

  it("stops after tier 1 and returns rate_limited without checking tiers 2 or 3", async () => {
    mockSignInWithPassword.mockResolvedValue(AUTH_ERROR);
    mockCheckRateLimit.mockResolvedValueOnce({ ok: false, reason: "rate_limited", retryAfterSeconds: 60 });
    const result = await signIn(INPUT);
    expect(result).toMatchObject({ ok: false, code: "rate_limited" });
    expect(mockCheckRateLimit).toHaveBeenCalledTimes(1);
  });

  it("cannot lock another user out: composite key includes both email AND ip", async () => {
    mockSignInWithPassword.mockResolvedValue(AUTH_ERROR);
    await signIn({ ...INPUT, email: "victim@example.com" });
    const compositeCall = mockCheckRateLimit.mock.calls[0]?.[0];
    expect(compositeCall).toMatchObject({ limitName: "signin-composite" });
    expect(compositeCall.key).toBeDefined();
  });

  it("tier 3 (per-email) returns captcha_failed, not rate_limited", async () => {
    mockSignInWithPassword.mockResolvedValue(AUTH_ERROR);
    mockCheckRateLimit
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false, reason: "rate_limited" });

    const result = await signIn(INPUT);
    expect(result).toEqual({ ok: false, code: "captcha_failed" });
  });

  it("tier 2 (per-IP) returns rate_limited with retryAfterSeconds", async () => {
    mockSignInWithPassword.mockResolvedValue(AUTH_ERROR);
    mockCheckRateLimit
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false, reason: "rate_limited", retryAfterSeconds: 599 });

    const result = await signIn(INPUT);
    expect(result).toEqual({ ok: false, code: "rate_limited", retryAfterSeconds: 599 });
  });
});
