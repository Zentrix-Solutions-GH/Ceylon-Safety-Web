// S-036: requestPasswordReset and resetPassword tests
// AC1, AC2, AC7, EC1, EC2, EC3

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────────────

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

const mockSignOut = vi.fn();
const mockResetPasswordForEmail = vi.fn();
const mockVerifyOtp = vi.fn();
const mockUpdateUser = vi.fn();
const mockMfaListFactors = vi.fn();
const mockMfaChallengeAndVerify = vi.fn();
const mockGetUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({
    auth: {
      signOut: mockSignOut,
      resetPasswordForEmail: mockResetPasswordForEmail,
      verifyOtp: mockVerifyOtp,
      updateUser: mockUpdateUser,
      mfa: {
        listFactors: mockMfaListFactors,
        challengeAndVerify: mockMfaChallengeAndVerify,
      },
      getUser: mockGetUser,
    },
  }),
}));

vi.mock("@/lib/ratelimit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("@/lib/auth/cookies", () => ({
  setPendingReset: vi.fn(),
  getPendingReset: vi.fn().mockResolvedValue(null),
  clearPendingReset: vi.fn(),
}));

const mockGetAttempts = vi.fn().mockResolvedValue(0);
const mockIncAttempts = vi.fn().mockResolvedValue(1);
const mockResetAttempts = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/auth/attempt-counter", () => ({
  getAttempts: (...args: unknown[]) => mockGetAttempts(...args),
  incAttempts: (...args: unknown[]) => mockIncAttempts(...args),
  resetAttempts: (...args: unknown[]) => mockResetAttempts(...args),
}));

import { checkRateLimit } from "@/lib/ratelimit";
// mockIncAttempts is referenced in the P1-fix test below; it is declared in the mock factory above.

// ── requestPasswordReset ─────────────────────────────────────────────────────

describe("requestPasswordReset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (checkRateLimit as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
    mockResetPasswordForEmail.mockResolvedValue({ error: null });
    mockGetAttempts.mockResolvedValue(0);
  });

  it("AC1: returns ok:true for a known email", async () => {
    const { requestPasswordReset } = await import("@/lib/auth/actions/request-password-reset");
    const result = await requestPasswordReset({
      email: "user@example.com",
      captchaToken: "tok",
    });
    expect(result.ok).toBe(true);
  });

  it("AC1/EC2: returns the same neutral ok:true for an unknown email (no account enumeration)", async () => {
    // Even if Supabase signals user not found, the response is the same
    mockResetPasswordForEmail.mockResolvedValue({
      error: { message: "User not found", status: 400 },
    });
    const { requestPasswordReset } = await import("@/lib/auth/actions/request-password-reset");
    const result = await requestPasswordReset({
      email: "unknown@example.com",
      captchaToken: "tok",
    });
    expect(result.ok).toBe(true);
  });

  it("AC1: rate_limited after 3 per hour per email", async () => {
    (checkRateLimit as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      code: "rate_limited",
      retryAfterSeconds: 120,
    });
    const { requestPasswordReset } = await import("@/lib/auth/actions/request-password-reset");
    const result = await requestPasswordReset({
      email: "user@example.com",
      captchaToken: "tok",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("rate_limited");
  });

  it("AC1: rate_limited after 10 per hour per IP", async () => {
    (checkRateLimit as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true }) // email limit
      .mockResolvedValueOnce({ ok: false, code: "rate_limited", retryAfterSeconds: 60 }); // IP limit
    const { requestPasswordReset } = await import("@/lib/auth/actions/request-password-reset");
    const result = await requestPasswordReset({
      email: "user@example.com",
      captchaToken: "tok",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("rate_limited");
  });

  it("validation: rejects missing captchaToken", async () => {
    const { requestPasswordReset } = await import("@/lib/auth/actions/request-password-reset");
    const result = await requestPasswordReset({ email: "user@example.com", captchaToken: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("validation_failed");
  });
});

// ── resetPassword ─────────────────────────────────────────────────────────────

describe("resetPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAttempts.mockResolvedValue(0);
    mockVerifyOtp.mockResolvedValue({
      data: { user: { id: "uid-1", email: "user@example.com" }, session: {} },
      error: null,
    });
    mockMfaListFactors.mockResolvedValue({
      data: { totp: [] }, // no authenticator by default
      error: null,
    });
    mockUpdateUser.mockResolvedValue({ error: null });
    mockSignOut.mockResolvedValue({ error: null });
  });

  it("AC2: verifies emailed code and sets password for regular user", async () => {
    const { resetPassword } = await import("@/lib/auth/actions/reset-password");
    const result = await resetPassword({
      email: "user@example.com",
      code: "12345678",
      newPassword: "newpass123",
    });
    expect(result.ok).toBe(true);
    expect(mockVerifyOtp).toHaveBeenCalledWith({
      email: "user@example.com",
      token: "12345678",
      type: "recovery",
    });
    expect(mockUpdateUser).toHaveBeenCalledWith({ password: "newpass123" });
    expect(mockSignOut).toHaveBeenCalledWith({ scope: "others" });
  });

  it("AC2/EC1: staff account with authenticator requires authenticatorCode", async () => {
    mockMfaListFactors.mockResolvedValue({
      data: { totp: [{ id: "factor-1", status: "verified" }] },
      error: null,
    });
    mockMfaChallengeAndVerify.mockResolvedValue({ data: {}, error: null });

    const { resetPassword } = await import("@/lib/auth/actions/reset-password");
    const result = await resetPassword({
      email: "admin@example.com",
      code: "12345678",
      newPassword: "newpass123",
      authenticatorCode: "123456",
    });
    expect(result.ok).toBe(true);
    expect(mockMfaChallengeAndVerify).toHaveBeenCalled();
  });

  it("AC2: staff account without authenticatorCode gets mfa_required", async () => {
    mockMfaListFactors.mockResolvedValue({
      data: { totp: [{ id: "factor-1", status: "verified" }] },
      error: null,
    });

    const { resetPassword } = await import("@/lib/auth/actions/reset-password");
    const result = await resetPassword({
      email: "admin@example.com",
      code: "12345678",
      newPassword: "newpass123",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("mfa_required");
  });

  it("AC7: wrong code returns code_invalid", async () => {
    mockVerifyOtp.mockResolvedValue({
      data: null,
      error: { message: "Token has expired or is invalid", status: 422 },
    });

    const { resetPassword } = await import("@/lib/auth/actions/reset-password");
    const result = await resetPassword({
      email: "user@example.com",
      code: "badcode",
      newPassword: "newpass123",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("code_invalid");
  });

  it("AC7: expired code returns code_expired", async () => {
    mockVerifyOtp.mockResolvedValue({
      data: null,
      error: { message: "Token has expired", status: 422 },
    });

    const { resetPassword } = await import("@/lib/auth/actions/reset-password");
    const result = await resetPassword({
      email: "user@example.com",
      code: "expiredcode",
      newPassword: "newpass123",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("code_expired");
  });

  it("AC7: after 5 wrong attempts returns code_attempts_exceeded", async () => {
    // Simulate the counter already at the limit
    mockGetAttempts.mockResolvedValue(5);
    const { resetPassword } = await import("@/lib/auth/actions/reset-password");
    const result = await resetPassword({
      email: "user@example.com",
      code: "bad",
      newPassword: "newpass123",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("code_attempts_exceeded");
  });

  it("AC2: weak password returns weak_password", async () => {
    // "password1" passes our schema (≥8 chars) but Supabase may reject it as weak
    mockUpdateUser.mockResolvedValue({
      error: { message: "Password should be at least 8 characters", status: 422 },
    });

    const { resetPassword } = await import("@/lib/auth/actions/reset-password");
    const result = await resetPassword({
      email: "user@example.com",
      code: "12345678",
      newPassword: "password1",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("weak_password");
  });

  it("EC3: reused code after password changed is refused", async () => {
    // After a successful reset, the code is consumed by Supabase; subsequent use returns invalid
    mockVerifyOtp
      .mockResolvedValueOnce({
        data: { user: { id: "uid-1", email: "user@example.com" }, session: {} },
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: { message: "Token has expired or is invalid", status: 422 },
      });

    const { resetPassword } = await import("@/lib/auth/actions/reset-password");
    await resetPassword({ email: "user@example.com", code: "12345678", newPassword: "newpass123" });
    const second = await resetPassword({
      email: "user@example.com",
      code: "12345678",
      newPassword: "anotherpass",
    });
    expect(second.ok).toBe(false);
  });

  it("AC2: other devices are signed out on success", async () => {
    const { resetPassword } = await import("@/lib/auth/actions/reset-password");
    await resetPassword({ email: "user@example.com", code: "12345678", newPassword: "newpass123" });
    expect(mockSignOut).toHaveBeenCalledWith({ scope: "others" });
  });

  it("EC4: Google-only user can reset password (no password identity) — adds password sign-in", async () => {
    // resetPassword does not check identities; Supabase handles adding password via recovery flow.
    const { resetPassword } = await import("@/lib/auth/actions/reset-password");
    const result = await resetPassword({
      email: "google@example.com",
      code: "12345678",
      newPassword: "newpass123",
    });
    expect(result.ok).toBe(true);
    expect(mockUpdateUser).toHaveBeenCalledWith({ password: "newpass123" });
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

    const { resetPassword } = await import("@/lib/auth/actions/reset-password");
    await resetPassword({ email: "admin@example.com", code: "12345678", newPassword: "newpass123", authenticatorCode: "000000" });
    expect(mockIncAttempts).toHaveBeenCalled();
  });

  it("S17: suspended (banned) user is rejected after valid code", async () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    mockVerifyOtp.mockResolvedValue({
      data: { user: { id: "uid-banned", email: "user@example.com", banned_until: future }, session: {} },
      error: null,
    });

    const { resetPassword } = await import("@/lib/auth/actions/reset-password");
    const result = await resetPassword({ email: "user@example.com", code: "12345678", newPassword: "newpass123" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_allowed");
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("P2: mfa.listFactors() returning null data falls back to unknown (no throw)", async () => {
    mockMfaListFactors.mockResolvedValue({ data: null, error: { message: "MFA service unavailable" } });
    mockVerifyOtp.mockResolvedValue({
      data: { user: { id: "uid-1", email: "admin@example.com" }, session: {} },
      error: null,
    });
    // listFactors null → factorsData is null → hasTotp false → password set normally
    // (the guard for a verified factor being absent was the fix; this confirms no throw)
    const { resetPassword } = await import("@/lib/auth/actions/reset-password");
    const result = await resetPassword({ email: "admin@example.com", code: "12345678", newPassword: "newpass123" });
    // null factorsData → no totp factors found → treated as non-staff, password set
    expect(result.ok).toBe(true);
  });
});
