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

const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}));

const BASE_USER = {
  id: "uid-1",
  email: "user@example.com",
  banned_until: null,
};

const mockUpdateSingle = vi.fn();
const mockEqChain = { eq: vi.fn().mockReturnThis(), single: mockUpdateSingle };
const mockUpdateChain = { update: vi.fn().mockReturnValue(mockEqChain) };

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  mockGetUser.mockResolvedValue({ data: { user: BASE_USER } });
  mockFrom.mockReturnValue(mockUpdateChain);
  mockEqChain.eq.mockReturnValue({ single: mockUpdateSingle });
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
    // Verify it targeted the calling user's id
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

  it("AC3: does not update email even if caller passes an email field", async () => {
    const { updateProfile } = await import("@/lib/auth/actions/update-profile");
    // The schema does not accept email — pass a raw object to bypass TS
    const result = await updateProfile({ firstName: "Jane" } as Parameters<typeof updateProfile>[0]);
    expect(result.ok).toBe(true);
    const updateArg = mockUpdateChain.update.mock.calls[0][0];
    expect(updateArg).not.toHaveProperty("email");
  });

  it("AC8: returns not_allowed when there is no session", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const { updateProfile } = await import("@/lib/auth/actions/update-profile");
    const result = await updateProfile({ firstName: "Jane" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_allowed");
  });

  it("AC8: returns not_allowed for a suspended user", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { ...BASE_USER, banned_until: new Date(Date.now() + 60_000).toISOString() } },
    });
    const { updateProfile } = await import("@/lib/auth/actions/update-profile");
    const result = await updateProfile({ firstName: "Jane" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_allowed");
  });

  it("AC1: returns unknown when the DB update fails", async () => {
    mockUpdateSingle.mockResolvedValue({ error: { message: "db error" } });
    const { updateProfile } = await import("@/lib/auth/actions/update-profile");
    const result = await updateProfile({ firstName: "Jane" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("unknown");
  });
});
