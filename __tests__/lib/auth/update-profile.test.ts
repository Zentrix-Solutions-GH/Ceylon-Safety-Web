// S-037: updateProfile tests — AC1, AC3, AC8, validation failures

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

const mockRequireActiveAccount = vi.fn();
vi.mock("@/lib/auth/server", () => ({
  requireActiveAccount: (...args: unknown[]) => mockRequireActiveAccount(...args),
}));

const mockFrom = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({
    from: mockFrom,
  }),
}));

const ACTIVE_USER = {
  id: "uid-1",
  email: "user@example.com",
  hasAuthenticatorLevel: false,
  hasTotpEnrolled: false,
};

const mockUpdateSingle = vi.fn();
const mockSelectChain = { single: mockUpdateSingle };
const mockEqChain = { eq: vi.fn().mockReturnThis(), select: vi.fn().mockReturnValue(mockSelectChain) };
const mockUpdateChain = { update: vi.fn().mockReturnValue(mockEqChain) };

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  mockRequireActiveAccount.mockResolvedValue({ ok: true, user: ACTIVE_USER });
  mockFrom.mockReturnValue(mockUpdateChain);
  mockEqChain.eq.mockReturnValue(mockEqChain);
  mockEqChain.select.mockReturnValue(mockSelectChain);
  mockUpdateChain.update.mockReturnValue(mockEqChain);
  mockUpdateSingle.mockResolvedValue({ error: null });
});

describe("updateProfile", () => {
  it("AC1: updates first name and last name for the calling user", async () => {
    const { updateProfile } = await import("@/lib/auth/actions/update-profile");
    const result = await updateProfile({ firstName: "Jane", lastName: "Doe" });
    expect(result.ok).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith("profiles");
    const updateArg = mockUpdateChain.update.mock.calls[0][0];
    expect(updateArg).toMatchObject({ first_name: "Jane", last_name: "Doe" });
    expect(mockEqChain.eq).toHaveBeenCalledWith("id", "uid-1");
  });

  it("AC1: updates phone, company, billing_address", async () => {
    const { updateProfile } = await import("@/lib/auth/actions/update-profile");
    const address = { line1: "10 Main St", city: "Colombo", country: "LK" };
    const result = await updateProfile({
      phone: "0771234567",
      companyName: "ACME",
      billingAddress: address,
    });
    expect(result.ok).toBe(true);
    const updateArg = mockUpdateChain.update.mock.calls[0][0];
    expect(updateArg).toMatchObject({
      phone: "0771234567",
      company_name: "ACME",
      billing_address: address,
    });
  });

  it("AC1: clears billing_address when null is passed", async () => {
    const { updateProfile } = await import("@/lib/auth/actions/update-profile");
    const result = await updateProfile({ billingAddress: null });
    expect(result.ok).toBe(true);
    const updateArg = mockUpdateChain.update.mock.calls[0][0];
    expect(updateArg).toHaveProperty("billing_address", null);
  });

  it("AC1: returns validation_failed with field when firstName is too long", async () => {
    const { updateProfile } = await import("@/lib/auth/actions/update-profile");
    const result = await updateProfile({ firstName: "A".repeat(51) });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("validation_failed");
      expect(result.field).toBe("firstName");
    }
  });

  it("AC3: does not update email even if a raw object with email is passed", async () => {
    const { updateProfile } = await import("@/lib/auth/actions/update-profile");
    // Cast to bypass TypeScript — simulates a caller injecting an email field
    const result = await updateProfile({ firstName: "Jane", ...({ email: "hack@evil.com" } as object) } as Parameters<typeof updateProfile>[0]);
    expect(result.ok).toBe(true);
    const updateArg = mockUpdateChain.update.mock.calls[0][0];
    expect(updateArg).not.toHaveProperty("email");
  });

  it("AC2: updateProfile passes display_name to DB (trigger sanitises — not bypassed)", async () => {
    const { updateProfile } = await import("@/lib/auth/actions/update-profile");
    // Action must write whatever displayName it receives to the DB payload;
    // the sanitise_profile trigger then rewrites staff-like values to "Member".
    // This confirms the action does not strip or bypass the trigger.
    await updateProfile({ displayName: "Jane D" });
    const updateArg = mockUpdateChain.update.mock.calls[0][0];
    expect(updateArg).toHaveProperty("display_name", "Jane D");
  });

  it("AC8: returns not_allowed when requireActiveAccount fails (no session)", async () => {
    mockRequireActiveAccount.mockResolvedValue({ ok: false, code: "reauth_required" });
    const { updateProfile } = await import("@/lib/auth/actions/update-profile");
    const result = await updateProfile({ firstName: "Jane" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_allowed");
  });

  it("AC8: returns not_allowed for a suspended user (profiles.status = suspended)", async () => {
    mockRequireActiveAccount.mockResolvedValue({ ok: false, code: "account_suspended" });
    const { updateProfile } = await import("@/lib/auth/actions/update-profile");
    const result = await updateProfile({ firstName: "Jane" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_allowed");
  });

  it("AC1: returns validation_failed with field 'displayName' when too short (1 char)", async () => {
    const { updateProfile } = await import("@/lib/auth/actions/update-profile");
    const result = await updateProfile({ displayName: "X" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("validation_failed");
      expect(result.field).toBe("displayName");
    }
  });

  it("AC1: returns validation_failed with field 'displayName' when too long (41 chars)", async () => {
    const { updateProfile } = await import("@/lib/auth/actions/update-profile");
    const result = await updateProfile({ displayName: "A".repeat(41) });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("validation_failed");
      expect(result.field).toBe("displayName");
    }
  });

  it("AC1: accepts displayName at max boundary (40 chars)", async () => {
    const { updateProfile } = await import("@/lib/auth/actions/update-profile");
    const result = await updateProfile({ displayName: "A".repeat(40) });
    expect(result.ok).toBe(true);
  });

  it("AC1: returns unknown when the DB update fails", async () => {
    mockUpdateSingle.mockResolvedValue({ error: { message: "db error" } });
    const { updateProfile } = await import("@/lib/auth/actions/update-profile");
    const result = await updateProfile({ firstName: "Jane" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("unknown");
  });
});
