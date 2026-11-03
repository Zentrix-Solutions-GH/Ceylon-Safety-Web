// S-040: welcome email sent exactly once — AC3
// Exercises the actual verifyEmail call site (not a mock-of-mock).

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({
  serverConfig: {
    supabaseServiceRoleKey: "service-role-key",
    resendApiKey: "re_test_key",
    emailFrom: "noreply@ceylonsafety.com",
  },
  publicConfig: {
    supabaseUrl: "https://test.supabase.co",
    supabaseAnonKey: "anon-key",
    appUrl: "https://ceylonsafety.com",
  },
}));

// Mock sendWelcomeEmail so we can count how many times verifyEmail calls it.
const mockSendWelcomeEmail = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/resend/client", () => ({
  sendWelcomeEmail: (...args: unknown[]) => mockSendWelcomeEmail(...args),
}));

const mockVerifyOtp = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { verifyOtp: mockVerifyOtp },
  })),
}));

vi.mock("@/lib/auth/attempt-counter", () => ({
  getAttempts: vi.fn().mockResolvedValue(0),
  incAttempts: vi.fn().mockResolvedValue(1),
  resetAttempts: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: vi.fn().mockReturnValue(undefined),
    set: vi.fn(),
    delete: vi.fn(),
  })),
}));

import { verifyEmail } from "@/lib/auth/actions/verify-email";

const USER = { id: "u-uuid", email: "user@example.com" };
const OTP_SUCCESS = { data: { user: USER, session: { user: USER } }, error: null };
const VALID_INPUT = { email: USER.email, code: "123456" };

describe("Welcome email — sent exactly once via verifyEmail (AC3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("AC3: verifyEmail calls sendWelcomeEmail with correct email and userId", async () => {
    mockVerifyOtp.mockResolvedValue(OTP_SUCCESS);

    await verifyEmail(VALID_INPUT);

    // Give the fire-and-forget promise a tick to settle
    await new Promise((r) => setTimeout(r, 0));

    expect(mockSendWelcomeEmail).toHaveBeenCalledWith(USER.email, USER.id);
  });

  it("AC3: two successive verifyEmail calls both invoke sendWelcomeEmail (unique-index guard in sendEmail prevents duplicate send)", async () => {
    mockVerifyOtp.mockResolvedValue(OTP_SUCCESS);

    await verifyEmail(VALID_INPUT);
    await verifyEmail(VALID_INPUT);
    await new Promise((r) => setTimeout(r, 0));

    // Both call sites fire; the unique index in sendEmail (tested in send.test.ts) prevents
    // the second Resend API call from going out.
    expect(mockSendWelcomeEmail).toHaveBeenCalledTimes(2);
    expect(mockSendWelcomeEmail).toHaveBeenCalledWith(USER.email, USER.id);
  });
});
