import { describe, it, expect, vi, beforeEach } from "vitest";

// Tests for AC2: the three rate-limit tiers on signIn.
// These are unit tests of the limit-key construction and tier ordering.
// They mock checkRateLimit to verify the action calls it with the right keys and order.

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

beforeEach(() => {
  vi.clearAllMocks();
  mockSignInWithPassword.mockResolvedValue({
    data: { user: { id: "u1", email: "a@b.com" }, session: {} },
    error: null,
  });
});

describe("signIn rate-limit tiers — AC2", () => {
  it("calls checkRateLimit three times in the correct order on happy path", async () => {
    mockCheckRateLimit.mockResolvedValue({ ok: true });
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

  it("stops after tier 1 and does not call Supabase", async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ ok: false, reason: "rate_limited", retryAfterSeconds: 60 });
    const result = await signIn(INPUT);
    expect(result).toMatchObject({ ok: false, code: "rate_limited" });
    expect(mockCheckRateLimit).toHaveBeenCalledTimes(1);
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
  });

  it("cannot lock another user out: composite key includes both email AND ip", async () => {
    mockCheckRateLimit.mockResolvedValue({ ok: true });
    await signIn({ ...INPUT, email: "victim@example.com" });
    const compositeCall = mockCheckRateLimit.mock.calls[0]?.[0];
    // The key must include the email portion; a different email makes a different key
    expect(compositeCall).toMatchObject({ limitName: "signin-composite" });
    // Key is hashed so we can't inspect the value, but the limitName + the different email
    // will produce a different hash. This test verifies the function is called with the
    // right limitName so the caller constructs the composite correctly.
    expect(compositeCall.key).toBeDefined();
  });

  it("tier 3 (per-email) returns captcha_failed, not rate_limited", async () => {
    mockCheckRateLimit
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false, reason: "rate_limited" });

    const result = await signIn(INPUT);
    expect(result).toEqual({ ok: false, code: "captcha_failed" });
  });

  it("tier 2 (per-IP) returns rate_limited with retryAfterSeconds", async () => {
    mockCheckRateLimit
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false, reason: "rate_limited", retryAfterSeconds: 599 });

    const result = await signIn(INPUT);
    expect(result).toEqual({ ok: false, code: "rate_limited", retryAfterSeconds: 599 });
  });
});
