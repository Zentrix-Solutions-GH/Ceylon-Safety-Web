// S-044: startMFAEnrolment and confirmMFAEnrolment server actions
// AC1, AC2, EC — Supabase MFA enrolment flow

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
import {
  startMFAEnrolment,
  confirmMFAEnrolment,
} from "@/lib/admin/actions/mfa-enrolment";

const STAFF_USER = {
  id: "aa000001-0000-4000-8000-000000000001",
  email: "admin@example.com",
  claimedRole: "admin" as const,
  hasAuthenticatorLevel: false,
  hasTotpEnrolled: false,
};

function mockAuth(ok: boolean, hasTotpEnrolled = false) {
  if (ok) {
    vi.mocked(requireStaffNoMfa).mockResolvedValue({
      ok: true,
      user: { ...STAFF_USER, hasTotpEnrolled },
    });
  } else {
    vi.mocked(requireStaffNoMfa).mockResolvedValue({
      ok: false,
      code: "not_allowed",
    });
  }
}

function makeSupabaseMock({
  listData = { all: [], totp: [] } as unknown,
  listError = null as unknown,
  unenrollData = {} as unknown,
  enrollData = null as unknown,
  enrollError = null as unknown,
  challengeData = null as unknown,
  challengeError = null as unknown,
  verifyData = null as unknown,
  verifyError = null as unknown,
} = {}) {
  const list = vi.fn().mockResolvedValue({ data: listData, error: listError });
  const unenroll = vi.fn().mockResolvedValue({ data: unenrollData, error: null });
  const enroll = vi.fn().mockResolvedValue({ data: enrollData, error: enrollError });
  const challenge = vi.fn().mockResolvedValue({ data: challengeData, error: challengeError });
  const verify = vi.fn().mockResolvedValue({ data: verifyData, error: verifyError });
  const mfa = { listFactors: list, unenroll, enroll, challenge, verify };
  const client = { auth: { mfa } };
  vi.mocked(createSupabaseServerClient).mockResolvedValue(client as never);
  return { list, unenroll, enroll, challenge, verify };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── startMFAEnrolment ───────────────────────────────────────────────────────

describe("startMFAEnrolment", () => {
  it("AC1: returns totp uri and secret for unenrolled staff (no pending factors)", async () => {
    mockAuth(true, false);
    makeSupabaseMock({
      listData: { all: [], totp: [] },
      enrollData: {
        id: "factor-id-1",
        type: "totp",
        totp: { qr_code: "data:image/svg...", secret: "JBSWY3DPEHPK3PXP", uri: "otpauth://totp/..." },
      },
    });

    const result = await startMFAEnrolment();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.factorId).toBe("factor-id-1");
      expect(result.uri).toContain("otpauth://");
      expect(result.secret).toBe("JBSWY3DPEHPK3PXP");
    }
  });

  it("cleans up stale pending factors before enrolling", async () => {
    mockAuth(true, false);
    const { unenroll, enroll } = makeSupabaseMock({
      listData: { all: [{ id: "stale-factor-id", factor_type: "totp", status: "unverified" }], totp: [] },
      enrollData: {
        id: "factor-id-2",
        type: "totp",
        totp: { qr_code: "data:image/svg...", secret: "NEWSECRET3DPEHPK", uri: "otpauth://totp/..." },
      },
    });

    const result = await startMFAEnrolment();

    expect(unenroll).toHaveBeenCalledWith({ factorId: "stale-factor-id" });
    expect(enroll).toHaveBeenCalled();
    expect(result.ok).toBe(true);
  });

  it("AC2: returns already_enrolled when staff already has verified TOTP", async () => {
    mockAuth(true, true);
    makeSupabaseMock();

    const result = await startMFAEnrolment();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("already_enrolled");
    }
  });

  it("returns not_allowed when no staff session", async () => {
    mockAuth(false);
    makeSupabaseMock();

    const result = await startMFAEnrolment();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("not_allowed");
    }
  });

  it("S17: returns not_allowed for a suspended account (requireStaffNoMfa blocked)", async () => {
    // requireStaffNoMfa → requireActiveAccount returns not_allowed for suspended users
    vi.mocked(requireStaffNoMfa).mockResolvedValue({ ok: false, code: "not_allowed" });
    makeSupabaseMock();

    const result = await startMFAEnrolment();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("not_allowed");
    }
  });

  it("EC: returns unknown when Supabase enroll fails", async () => {
    mockAuth(true, false);
    makeSupabaseMock({ listData: { all: [], totp: [] }, enrollError: { message: "supabase error" } });

    const result = await startMFAEnrolment();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("unknown");
    }
  });
});

// ─── confirmMFAEnrolment ─────────────────────────────────────────────────────

describe("confirmMFAEnrolment", () => {
  it("AC1: confirms enrolment with valid code and returns ok", async () => {
    mockAuth(true, false);
    makeSupabaseMock({
      listData: { all: [{ id: "factor-id-1", factor_type: "totp", status: "unverified" }], totp: [] },
      challengeData: { id: "challenge-id-1", type: "totp" },
      verifyData: { user: { id: STAFF_USER.id } },
    });

    const result = await confirmMFAEnrolment({ factorId: "factor-id-1", code: "123456" });

    expect(result.ok).toBe(true);
  });

  it("AC1: returns code_invalid for wrong TOTP code", async () => {
    mockAuth(true, false);
    makeSupabaseMock({
      listData: { all: [{ id: "factor-id-1", factor_type: "totp", status: "unverified" }], totp: [] },
      challengeData: { id: "challenge-id-1", type: "totp" },
      verifyError: { message: "invalid TOTP", status: 422 },
    });

    const result = await confirmMFAEnrolment({ factorId: "factor-id-1", code: "000000" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("code_invalid");
    }
  });

  it("returns code_attempts_exceeded on 429 from Supabase", async () => {
    mockAuth(true, false);
    makeSupabaseMock({
      listData: { all: [{ id: "factor-id-1", factor_type: "totp", status: "unverified" }], totp: [] },
      challengeData: { id: "challenge-id-1", type: "totp" },
      verifyError: { message: "mfa_totp_challenge_expired", status: 429 },
    });

    const result = await confirmMFAEnrolment({ factorId: "factor-id-1", code: "123456" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("code_attempts_exceeded");
    }
  });

  it("returns not_found when factorId does not belong to calling user", async () => {
    mockAuth(true, false);
    makeSupabaseMock({
      // listFactors returns a different factor or empty — factorId not owned
      listData: { all: [{ id: "other-factor-id", factor_type: "totp", status: "unverified" }], totp: [] },
    });

    const result = await confirmMFAEnrolment({ factorId: "factor-id-1", code: "123456" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("not_found");
    }
  });

  it("returns validation_failed for non-6-digit code", async () => {
    mockAuth(true, false);
    makeSupabaseMock();

    const result = await confirmMFAEnrolment({ factorId: "factor-id-1", code: "12" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("validation_failed");
    }
  });

  it("returns not_allowed when no staff session", async () => {
    mockAuth(false);
    makeSupabaseMock();

    const result = await confirmMFAEnrolment({ factorId: "factor-id-1", code: "123456" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("not_allowed");
    }
  });

  it("S17: returns not_allowed for a suspended account (requireStaffNoMfa blocked)", async () => {
    vi.mocked(requireStaffNoMfa).mockResolvedValue({ ok: false, code: "not_allowed" });
    makeSupabaseMock();

    const result = await confirmMFAEnrolment({ factorId: "factor-id-1", code: "123456" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("not_allowed");
    }
  });
});
