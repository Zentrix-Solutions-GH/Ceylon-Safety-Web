// S-036: changePassword tests
// AC5

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

const mockUpdateUser = vi.fn();
const mockGetUser = vi.fn();

const mockGetAttempts = vi.fn().mockResolvedValue(0);
const mockIncAttempts = vi.fn().mockResolvedValue(1);
const mockResetAttempts = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/auth/attempt-counter", () => ({
  getAttempts: (...args: unknown[]) => mockGetAttempts(...args),
  incAttempts: (...args: unknown[]) => mockIncAttempts(...args),
  resetAttempts: (...args: unknown[]) => mockResetAttempts(...args),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({
    auth: {
      updateUser: mockUpdateUser,
      getUser: mockGetUser,
    },
  }),
}));

describe("changePassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAttempts.mockResolvedValue(0);
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "uid-1",
          email: "user@example.com",
          identities: [
            { provider: "email", id: "uid-1" },
          ],
        },
      },
      error: null,
    });
    mockUpdateUser.mockResolvedValue({ data: {}, error: null });
  });

  it("AC5: changes password for a signed-in user with a password identity", async () => {
    const { changePassword } = await import("@/lib/auth/actions/change-password");
    const result = await changePassword({ code: "reauthcode", newPassword: "newpass123" });
    expect(result.ok).toBe(true);
    expect(mockUpdateUser).toHaveBeenCalledWith({
      password: "newpass123",
      nonce: "reauthcode",
    });
  });

  it("AC5: Google-only account (no password identity) gets not_allowed", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "uid-google",
          email: "google@example.com",
          // only google identity — no email/password identity
          identities: [{ provider: "google", id: "uid-google" }],
        },
      },
      error: null,
    });

    const { changePassword } = await import("@/lib/auth/actions/change-password");
    const result = await changePassword({ code: "reauthcode", newPassword: "newpass123" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_allowed");
  });

  it("AC5: user who added a password after Google sign-in is allowed", async () => {
    // Has both google AND email identities → has a password → allowed
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "uid-both",
          email: "both@example.com",
          identities: [
            { provider: "google", id: "uid-both" },
            { provider: "email", id: "uid-both" },
          ],
        },
      },
      error: null,
    });

    const { changePassword } = await import("@/lib/auth/actions/change-password");
    const result = await changePassword({ code: "reauthcode", newPassword: "newpass123" });
    expect(result.ok).toBe(true);
  });

  it("AC5: unauthenticated (no user) returns not_allowed", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const { changePassword } = await import("@/lib/auth/actions/change-password");
    const result = await changePassword({ code: "reauthcode", newPassword: "newpass123" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_allowed");
  });

  it("AC5: weak password returns weak_password", async () => {
    // "password1" passes our schema (≥8 chars) but Supabase returns a weak-password error
    mockUpdateUser.mockResolvedValue({
      error: { message: "Password should be at least 8 characters", status: 422 },
    });

    const { changePassword } = await import("@/lib/auth/actions/change-password");
    const result = await changePassword({ code: "reauthcode", newPassword: "password1" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("weak_password");
  });

  it("AC5: invalid reauthentication code returns code_invalid", async () => {
    mockUpdateUser.mockResolvedValue({
      error: { message: "Token has expired or is invalid", status: 422 },
    });

    const { changePassword } = await import("@/lib/auth/actions/change-password");
    const result = await changePassword({ code: "badcode", newPassword: "newpass123" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("code_invalid");
  });

  it("validation: rejects empty code", async () => {
    const { changePassword } = await import("@/lib/auth/actions/change-password");
    const result = await changePassword({ code: "", newPassword: "newpass123" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("validation_failed");
  });

  it("P0 fix: code_attempts_exceeded after 5 failed nonce attempts", async () => {
    mockGetAttempts.mockResolvedValue(5);
    const { changePassword } = await import("@/lib/auth/actions/change-password");
    const result = await changePassword({ code: "reauthcode", newPassword: "newpass123" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("code_attempts_exceeded");
  });
});
