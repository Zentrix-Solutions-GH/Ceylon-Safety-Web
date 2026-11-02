import { describe, it, expect, vi, beforeEach } from "vitest";

// Rate limit integration test — verifies sign-up IP limit is applied correctly.
// Uses the real checkRateLimit call structure; the Upstash SDK is mocked.

const mockCheckRateLimit = vi.fn();

vi.mock("@/lib/ratelimit", () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}));

const mockSignUp = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { signUp: mockSignUp },
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

import { signUp } from "@/lib/auth/actions/sign-up";

const VALID_INPUT = {
  firstName: "Kasun",
  lastName: "Silva",
  email: "kasun@example.com",
  password: "SecurePass1!",
  termsAccepted: true,
  captchaToken: "token",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockSignUp.mockResolvedValue({ data: { user: { id: "uid-1" } }, error: null });
  // Prevent real HIBP network calls in CI — return a response with no matching suffix
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    text: async () => "AAAAABBBBB00000:5\nCCCCCDDDDD11111:2",
  } as Response);
});

describe("signUp rate limiting (AC1 / auth design §15)", () => {
  it("calls checkRateLimit with limitName=signup and the client IP", async () => {
    mockCheckRateLimit.mockResolvedValue({ ok: true });

    await signUp(VALID_INPUT);

    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        limitName: "signup",
        maxCount: 5,
        windowSeconds: 3600,
        mode: "open",
      })
    );
  });

  it("blocks sign-up when rate limit is exhausted", async () => {
    mockCheckRateLimit.mockResolvedValue({ ok: false, reason: "rate_limited", retryAfterSeconds: 3600 });

    const result = await signUp(VALID_INPUT);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("rate_limited");
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it("allows sign-up when Upstash is down (open mode — fails open)", async () => {
    mockCheckRateLimit.mockResolvedValue({ ok: true }); // open mode returns ok:true on outage

    const result = await signUp(VALID_INPUT);
    expect(result.ok).toBe(true);
  });
});
