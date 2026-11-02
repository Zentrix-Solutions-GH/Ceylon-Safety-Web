// S-036: requestReverification and confirmReverification tests
// AC6, AC7

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Map()),
  cookies: vi.fn().mockResolvedValue({
    set: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
  }),
}));
vi.mock("@/lib/config.upstash", () => ({ upstashConfig: vi.fn().mockReturnValue(null) }));

const mockSignInWithOtp = vi.fn();
const mockVerifyOtp = vi.fn();
const mockGetUser = vi.fn();
const mockMfaListFactors = vi.fn();
const mockMfaChallengeAndVerify = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({
    auth: {
      signInWithOtp: mockSignInWithOtp,
      verifyOtp: mockVerifyOtp,
      getUser: mockGetUser,
      mfa: {
        listFactors: mockMfaListFactors,
        challengeAndVerify: mockMfaChallengeAndVerify,
      },
    },
  }),
}));

const mockCheckRateLimit = vi.fn();
vi.mock("@/lib/ratelimit", () => ({
  checkRateLimit: mockCheckRateLimit,
}));

const mockGetAttempts = vi.fn().mockResolvedValue(0);
const mockIncAttempts = vi.fn().mockResolvedValue(1);
const mockResetAttempts = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/auth/attempt-counter", () => ({
  getAttempts: (...args: unknown[]) => mockGetAttempts(...args),
  incAttempts: (...args: unknown[]) => mockIncAttempts(...args),
  resetAttempts: (...args: unknown[]) => mockResetAttempts(...args),
}));

// ── requestReverification ────────────────────────────────────────────────────

describe("requestReverification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "uid-1", email: "user@example.com" } },
      error: null,
    });
    mockSignInWithOtp.mockResolvedValue({ error: null });
    mockCheckRateLimit.mockResolvedValue({ ok: true });
  });

  it("AC6: sends a fresh code to the signed-in user", async () => {
    const { requestReverification } = await import(
      "@/lib/auth/actions/request-reverification"
    );
    const result = await requestReverification({ captchaToken: "tok" });
    expect(result.ok).toBe(true);
    expect(mockSignInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "user@example.com",
        options: expect.objectContaining({ shouldCreateUser: false }),
      })
    );
  });

  it("AC6: rate_limited on 4th request per hour", async () => {
    mockCheckRateLimit.mockResolvedValue({
      ok: false,
      code: "rate_limited",
      retryAfterSeconds: 300,
    });
    const { requestReverification } = await import(
      "@/lib/auth/actions/request-reverification"
    );
    const result = await requestReverification({ captchaToken: "tok" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("rate_limited");
  });

  it("AC6: not_allowed when no session", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const { requestReverification } = await import(
      "@/lib/auth/actions/request-reverification"
    );
    const result = await requestReverification({ captchaToken: "tok" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_allowed");
  });

  it("P1: suspended user gets not_allowed", async () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "uid-banned", email: "banned@example.com", banned_until: future } },
      error: null,
    });
    const { requestReverification } = await import(
      "@/lib/auth/actions/request-reverification"
    );
    const result = await requestReverification({ captchaToken: "tok" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_allowed");
    expect(mockSignInWithOtp).not.toHaveBeenCalled();
  });

  it("validation: rejects empty captchaToken", async () => {
    const { requestReverification } = await import(
      "@/lib/auth/actions/request-reverification"
    );
    const result = await requestReverification({ captchaToken: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("validation_failed");
  });
});

// ── confirmReverification ─────────────────────────────────────────────────────

describe("confirmReverification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAttempts.mockResolvedValue(0);
    mockGetUser.mockResolvedValue({
      data: { user: { id: "uid-1", email: "user@example.com" } },
      error: null,
    });
    mockVerifyOtp.mockResolvedValue({
      data: { user: { id: "uid-1" }, session: {} },
      error: null,
    });
    mockMfaListFactors.mockResolvedValue({
      data: { totp: [] },
      error: null,
    });
  });

  it("AC6: verifies OTP for regular user", async () => {
    const { confirmReverification } = await import(
      "@/lib/auth/actions/confirm-reverification"
    );
    const result = await confirmReverification({ code: "12345678" });
    expect(result.ok).toBe(true);
    expect(mockVerifyOtp).toHaveBeenCalledWith(
      expect.objectContaining({ token: "12345678", type: "magiclink" })
    );
  });

  it("AC6: staff with authenticator requires authenticatorCode", async () => {
    mockMfaListFactors.mockResolvedValue({
      data: { totp: [{ id: "factor-1", status: "verified" }] },
      error: null,
    });
    mockMfaChallengeAndVerify.mockResolvedValue({ data: {}, error: null });

    const { confirmReverification } = await import(
      "@/lib/auth/actions/confirm-reverification"
    );
    const result = await confirmReverification({
      code: "12345678",
      authenticatorCode: "123456",
    });
    expect(result.ok).toBe(true);
    expect(mockMfaChallengeAndVerify).toHaveBeenCalled();
  });

  it("AC6: staff without authenticatorCode gets mfa_required", async () => {
    mockMfaListFactors.mockResolvedValue({
      data: { totp: [{ id: "factor-1", status: "verified" }] },
      error: null,
    });

    const { confirmReverification } = await import(
      "@/lib/auth/actions/confirm-reverification"
    );
    const result = await confirmReverification({ code: "12345678" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("mfa_required");
  });

  it("AC7: wrong code returns code_invalid", async () => {
    mockVerifyOtp.mockResolvedValue({
      data: null,
      error: { message: "Token has expired or is invalid", status: 422 },
    });

    const { confirmReverification } = await import(
      "@/lib/auth/actions/confirm-reverification"
    );
    const result = await confirmReverification({ code: "badcode" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("code_invalid");
  });

  it("AC7: wrong authenticator code returns code_invalid", async () => {
    mockMfaListFactors.mockResolvedValue({
      data: { totp: [{ id: "factor-1", status: "verified" }] },
      error: null,
    });
    mockMfaChallengeAndVerify.mockResolvedValue({
      data: null,
      error: { message: "Invalid TOTP code", status: 422 },
    });

    const { confirmReverification } = await import(
      "@/lib/auth/actions/confirm-reverification"
    );
    const result = await confirmReverification({
      code: "12345678",
      authenticatorCode: "000000",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("code_invalid");
  });

  it("AC7: after 5 wrong attempts returns code_attempts_exceeded", async () => {
    mockGetAttempts.mockResolvedValue(5);
    const { confirmReverification } = await import(
      "@/lib/auth/actions/confirm-reverification"
    );
    const result = await confirmReverification({ code: "bad" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("code_attempts_exceeded");
  });

  it("AC6: not_allowed when no session", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const { confirmReverification } = await import(
      "@/lib/auth/actions/confirm-reverification"
    );
    const result = await confirmReverification({ code: "12345678" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_allowed");
  });

  it("P1: suspended user gets not_allowed in confirmReverification", async () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "uid-banned", email: "banned@example.com", banned_until: future } },
      error: null,
    });
    const { confirmReverification } = await import(
      "@/lib/auth/actions/confirm-reverification"
    );
    const result = await confirmReverification({ code: "12345678" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_allowed");
  });

  it("P1 fix: wrong TOTP code increments the attempt counter", async () => {
    mockMfaListFactors.mockResolvedValue({
      data: { totp: [{ id: "factor-1", status: "verified" }] },
      error: null,
    });
    mockMfaChallengeAndVerify.mockResolvedValue({
      data: null,
      error: { message: "Invalid TOTP code", status: 422 },
    });

    const { confirmReverification } = await import(
      "@/lib/auth/actions/confirm-reverification"
    );
    await confirmReverification({ code: "12345678", authenticatorCode: "000000" });
    expect(mockIncAttempts).toHaveBeenCalled();
  });
});
