// S-044: submitMFAChallenge server action
// AC3, AC4, EC1

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({
  serverConfig: { supabaseServiceRoleKey: "srk" },
  publicConfig: { supabaseUrl: "https://test.supabase.co", supabaseAnonKey: "anon" },
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));
vi.mock("@/lib/auth/server", () => ({
  requireStaffNoMfa: vi.fn(),
}));

import { requireStaffNoMfa } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { submitMFAChallenge } from "@/lib/admin/actions/mfa-challenge";

const STAFF_USER = {
  id: "aa000001-0000-4000-8000-000000000001",
  email: "admin@example.com",
  claimedRole: "admin" as const,
  hasAuthenticatorLevel: false,
  hasTotpEnrolled: true,
};

function mockAuth(ok: boolean, hasTotpEnrolled = true) {
  if (ok) {
    vi.mocked(requireStaffNoMfa).mockResolvedValue({
      ok: true,
      user: { ...STAFF_USER, hasTotpEnrolled },
    });
  } else {
    vi.mocked(requireStaffNoMfa).mockResolvedValue({
      ok: false,
      code: "reauth_required",
    });
  }
}

function makeSupabaseMock({
  listData = null as unknown,
  listError = null as unknown,
  challengeData = null as unknown,
  challengeError = null as unknown,
  verifyData = null as unknown,
  verifyError = null as unknown,
} = {}) {
  const list = vi.fn().mockResolvedValue({ data: listData, error: listError });
  const challenge = vi.fn().mockResolvedValue({ data: challengeData, error: challengeError });
  const verify = vi.fn().mockResolvedValue({ data: verifyData, error: verifyError });
  const mfa = { listFactors: list, challenge, verify };
  const client = { auth: { mfa } };
  vi.mocked(createSupabaseServerClient).mockResolvedValue(client as never);
  return { list, challenge, verify };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("submitMFAChallenge", () => {
  it("AC3: accepts correct TOTP code and returns ok", async () => {
    mockAuth(true, true);
    makeSupabaseMock({
      listData: { totp: [{ id: "factor-id-1", status: "verified" }] },
      challengeData: { id: "challenge-id-1" },
      verifyData: { user: { id: STAFF_USER.id } },
    });

    const result = await submitMFAChallenge({ code: "123456" });

    expect(result.ok).toBe(true);
  });

  it("AC3: returns code_invalid for wrong code", async () => {
    mockAuth(true, true);
    makeSupabaseMock({
      listData: { totp: [{ id: "factor-id-1", status: "verified" }] },
      challengeData: { id: "challenge-id-1" },
      verifyError: { message: "invalid TOTP", status: 422 },
    });

    const result = await submitMFAChallenge({ code: "000000" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("code_invalid");
    }
  });

  it("AC4: returns mfa_required when no TOTP factor enrolled", async () => {
    mockAuth(true, false);
    makeSupabaseMock({
      listData: { totp: [] },
    });

    const result = await submitMFAChallenge({ code: "123456" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("mfa_required");
    }
  });

  it("returns not_allowed when no staff session", async () => {
    mockAuth(false);
    makeSupabaseMock();

    const result = await submitMFAChallenge({ code: "123456" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("reauth_required");
    }
  });

  it("returns validation_failed for non-6-digit code", async () => {
    mockAuth(true, true);
    makeSupabaseMock();

    const result = await submitMFAChallenge({ code: "12" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("validation_failed");
    }
  });

  it("AC3: returns code_attempts_exceeded on 429 from Supabase", async () => {
    mockAuth(true, true);
    makeSupabaseMock({
      listData: { totp: [{ id: "factor-id-1", status: "verified" }] },
      challengeData: { id: "challenge-id-1" },
      verifyError: { message: "mfa_totp_challenge_expired", status: 429 },
    });

    const result = await submitMFAChallenge({ code: "123456" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("code_attempts_exceeded");
    }
  });

  it("EC — returns unknown when Supabase challenge fails", async () => {
    mockAuth(true, true);
    makeSupabaseMock({
      listData: { totp: [{ id: "factor-id-1", status: "verified" }] },
      challengeError: { message: "supabase error" },
    });

    const result = await submitMFAChallenge({ code: "123456" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("unknown");
    }
  });
});
