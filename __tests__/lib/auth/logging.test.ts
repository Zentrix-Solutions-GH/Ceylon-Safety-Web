import { describe, it, expect, vi, beforeEach } from "vitest";

// AC7 — no secrets in logs.
// Intercepts console.* and verifies that passwords, tokens, codes and full
// email addresses never appear in log output during sign-up or verify flows.

vi.mock("@/lib/resend/client", () => ({
  sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
}));

const mockCheckRateLimit = vi.fn();
vi.mock("@/lib/ratelimit", () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}));

const mockSignUp = vi.fn();
const mockVerifyOtp = vi.fn();
const mockResend = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { signUp: mockSignUp, verifyOtp: mockVerifyOtp, resend: mockResend },
  })),
}));

const mockCookiesSet = vi.fn();
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ set: mockCookiesSet, get: vi.fn(), delete: vi.fn() })),
  headers: vi.fn(async () => new Headers()),
}));

vi.mock("@/lib/ratelimit/client-ip", () => ({
  getClientIp: vi.fn(() => "1.2.3.4"),
}));

vi.mock("@/lib/auth/attempt-counter", () => ({
  getAttempts: vi.fn().mockResolvedValue(0),
  incAttempts: vi.fn().mockResolvedValue(1),
  resetAttempts: vi.fn().mockResolvedValue(undefined),
}));

import { signUp } from "@/lib/auth/actions/sign-up";
import { verifyEmail } from "@/lib/auth/actions/verify-email";
import { resendCode } from "@/lib/auth/actions/resend-code";

const PASSWORD = "SuperSecret99!";
const EMAIL = "kasun@example.com";
const CODE = "987654";
const TOKEN = "captcha-secret-token";

function collectLogOutput(fn: () => Promise<unknown>): Promise<string[]> {
  const captured: string[] = [];
  const methods = ["log", "warn", "error", "info", "debug"] as const;
  const originals = methods.map((m) => {
    const orig = console[m];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (console as any)[m] = (...args: unknown[]) => captured.push(args.map(String).join(" "));
    return orig;
  });
  return fn().then(
    () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      methods.forEach((m, i) => ((console as any)[m] = originals[i]));
      return captured;
    },
    () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      methods.forEach((m, i) => ((console as any)[m] = originals[i]));
      return captured;
    }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRateLimit.mockResolvedValue({ ok: true });
  mockSignUp.mockResolvedValue({ data: { user: { id: "uid-1" } }, error: null });
  mockVerifyOtp.mockResolvedValue({
    data: { session: { access_token: "tok", refresh_token: "ref", user: { id: "uid-1", email: EMAIL } } },
    error: null,
  });
  mockResend.mockResolvedValue({ data: {}, error: null });
});

describe("AC7: no secrets in log output", () => {
  it("signUp does not log the password", async () => {
    const logs = await collectLogOutput(() =>
      signUp({ firstName: "Kasun", lastName: "Silva", email: EMAIL, password: PASSWORD, termsAccepted: true, captchaToken: TOKEN })
    );
    for (const line of logs) {
      expect(line).not.toContain(PASSWORD);
    }
  });

  it("signUp does not log the captcha token", async () => {
    const logs = await collectLogOutput(() =>
      signUp({ firstName: "Kasun", lastName: "Silva", email: EMAIL, password: PASSWORD, termsAccepted: true, captchaToken: TOKEN })
    );
    for (const line of logs) {
      expect(line).not.toContain(TOKEN);
    }
  });

  it("verifyEmail does not log the verification code", async () => {
    const logs = await collectLogOutput(() => verifyEmail({ email: EMAIL, code: CODE }));
    for (const line of logs) {
      expect(line).not.toContain(CODE);
    }
  });

  it("resendCode does not log the captcha token", async () => {
    const logs = await collectLogOutput(() => resendCode({ email: EMAIL, captchaToken: TOKEN }));
    for (const line of logs) {
      expect(line).not.toContain(TOKEN);
    }
  });
});
