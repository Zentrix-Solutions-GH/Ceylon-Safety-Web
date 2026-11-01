import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Supabase mock
// ---------------------------------------------------------------------------

const mockVerifyOtp = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { verifyOtp: mockVerifyOtp },
  })),
}));

// ---------------------------------------------------------------------------
// Attempt counter mock
// ---------------------------------------------------------------------------

const mockGetAttempts = vi.fn();
const mockIncAttempts = vi.fn();
const mockResetAttempts = vi.fn();

vi.mock("@/lib/auth/attempt-counter", () => ({
  getAttempts: (...args: unknown[]) => mockGetAttempts(...args),
  incAttempts: (...args: unknown[]) => mockIncAttempts(...args),
  resetAttempts: (...args: unknown[]) => mockResetAttempts(...args),
}));

// ---------------------------------------------------------------------------
// Cookies mock
// ---------------------------------------------------------------------------

const mockCookiesGet = vi.fn();
const mockCookiesSet = vi.fn();
const mockCookiesDelete = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: mockCookiesGet,
    set: mockCookiesSet,
    delete: mockCookiesDelete,
  })),
  headers: vi.fn(async () => new Headers()),
}));

import { verifyEmail } from "@/lib/auth/actions/verify-email";

const VALID_INPUT = { email: "kasun@example.com", code: "123456" };

const SUPABASE_SESSION = {
  access_token: "tok",
  refresh_token: "ref",
  user: { id: "uid-1", email: "kasun@example.com" },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAttempts.mockResolvedValue(0);
  mockIncAttempts.mockResolvedValue(1);
  mockResetAttempts.mockResolvedValue(undefined);
  // No pending cookie by default — EC1 path
  mockCookiesGet.mockReturnValue(undefined);
  mockVerifyOtp.mockResolvedValue({ data: { session: SUPABASE_SESSION }, error: null });
});

// ---------------------------------------------------------------------------
// AC4 — verify code happy path
// ---------------------------------------------------------------------------

describe("verifyEmail — AC4: happy path", () => {
  it("returns redirect to home when no saved next", async () => {
    const result = await verifyEmail(VALID_INPUT);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result as { ok: true; redirect: string }).redirect).toBe("/");
    }
  });

  it("returns redirect to saved next page (from cookie)", async () => {
    mockCookiesGet.mockImplementation((name: string) => {
      if (name === "pending_signup") return { value: JSON.stringify({ email: "kasun@example.com", next: "/dashboard" }) };
      return undefined;
    });

    const result = await verifyEmail(VALID_INPUT);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result as { ok: true; redirect: string }).redirect).toBe("/dashboard");
    }
  });

  it("sanitises hostile next through safeNext (EC6)", async () => {
    mockCookiesGet.mockImplementation((name: string) => {
      if (name === "pending_signup") return { value: JSON.stringify({ email: "kasun@example.com", next: "https://evil.com" }) };
      return undefined;
    });

    const result = await verifyEmail(VALID_INPUT);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result as { ok: true; redirect: string }).redirect).toBe("/");
    }
  });

  it("calls Supabase verifyOtp with type=email", async () => {
    await verifyEmail(VALID_INPUT);
    expect(mockVerifyOtp).toHaveBeenCalledWith(
      expect.objectContaining({ email: "kasun@example.com", token: "123456", type: "email" })
    );
  });

  it("resets attempt counter on success", async () => {
    await verifyEmail(VALID_INPUT);
    expect(mockResetAttempts).toHaveBeenCalledWith("kasun@example.com");
  });

  it("clears pending cookie on success", async () => {
    await verifyEmail(VALID_INPUT);
    expect(mockCookiesDelete).toHaveBeenCalledWith("pending_signup");
  });
});

// ---------------------------------------------------------------------------
// AC4 — wrong code → code_invalid
// ---------------------------------------------------------------------------

describe("verifyEmail — AC4: wrong code", () => {
  it("returns code_invalid for a wrong code", async () => {
    mockVerifyOtp.mockResolvedValue({
      data: { session: null },
      error: { message: "Token has expired or is invalid", status: 403 },
    });

    const result = await verifyEmail(VALID_INPUT);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("code_invalid");
  });

  it("does NOT clear the pending cookie on code_invalid", async () => {
    mockVerifyOtp.mockResolvedValue({
      data: { session: null },
      error: { message: "Token has expired or is invalid", status: 403 },
    });

    await verifyEmail(VALID_INPUT);
    expect(mockCookiesDelete).not.toHaveBeenCalled();
  });

  it("increments attempt counter on wrong code", async () => {
    mockVerifyOtp.mockResolvedValue({
      data: { session: null },
      error: { message: "Token has expired or is invalid", status: 403 },
    });

    await verifyEmail(VALID_INPUT);
    expect(mockIncAttempts).toHaveBeenCalledWith("kasun@example.com");
  });
});

// ---------------------------------------------------------------------------
// AC4 — expired code → code_expired
// ---------------------------------------------------------------------------

describe("verifyEmail — AC4: expired code", () => {
  it("returns code_expired when Supabase reports OTP expired", async () => {
    mockVerifyOtp.mockResolvedValue({
      data: { session: null },
      error: { message: "Email link is invalid or has expired", status: 403 },
    });

    const result = await verifyEmail(VALID_INPUT);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("code_expired");
  });

  it("does NOT increment attempt counter for code_expired (P0 regression guard)", async () => {
    mockVerifyOtp.mockResolvedValue({
      data: { session: null },
      error: { message: "Email link is invalid or has expired", status: 403 },
    });

    await verifyEmail(VALID_INPUT);
    expect(mockIncAttempts).not.toHaveBeenCalled();
  });

  it("does NOT clear the pending cookie on code_expired", async () => {
    mockVerifyOtp.mockResolvedValue({
      data: { session: null },
      error: { message: "Email link is invalid or has expired", status: 403 },
    });

    await verifyEmail(VALID_INPUT);
    expect(mockCookiesDelete).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// AC4 — 5 wrong tries → code_attempts_exceeded
// ---------------------------------------------------------------------------

describe("verifyEmail — AC4: attempts exceeded", () => {
  it("returns code_attempts_exceeded after 5 wrong tries", async () => {
    mockGetAttempts.mockResolvedValue(5);

    const result = await verifyEmail(VALID_INPUT);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("code_attempts_exceeded");
    // Should not even try to verify once the threshold is hit
    expect(mockVerifyOtp).not.toHaveBeenCalled();
  });

  it("allows verify when attempts are exactly 4 (threshold is 5)", async () => {
    mockGetAttempts.mockResolvedValue(4);
    const result = await verifyEmail(VALID_INPUT);
    expect(mockVerifyOtp).toHaveBeenCalled();
    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// EC1 — verifyEmail called from another device (no cookie)
// ---------------------------------------------------------------------------

describe("verifyEmail — EC1: no pending cookie", () => {
  it("works using the email from the input when no cookie is present", async () => {
    mockCookiesGet.mockReturnValue(undefined);
    const result = await verifyEmail({ email: "kasun@example.com", code: "123456" });
    expect(result.ok).toBe(true);
    expect(mockVerifyOtp).toHaveBeenCalledWith(
      expect.objectContaining({ email: "kasun@example.com" })
    );
  });
});
