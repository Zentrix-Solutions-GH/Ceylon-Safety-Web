import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
    rpc: mockRpc,
  })),
  createSupabaseServiceRoleClient: vi.fn(() => ({
    rpc: mockRpc,
  })),
}));

import { assertNotSuperAdminTarget } from "@/lib/auth/server";

const NOW_ISO = new Date().toISOString();
const RECENT_AMR_TS = Math.floor(Date.now() / 1000) - 1800;

function makeStaffUser(role: string) {
  return {
    id: role === "super_admin" ? "sa-1" : "admin-1",
    email: "staff@example.com",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: NOW_ISO,
    last_sign_in_at: new Date(Date.now() - 3600 * 1000).toISOString(),
    factors: [{ factor_type: "totp", status: "verified" }],
    amr: [
      { method: "password", timestamp: RECENT_AMR_TS },
      { method: "totp", timestamp: RECENT_AMR_TS },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("assertNotSuperAdminTarget (AC7)", () => {
  it("returns mfa_required when caller has no TOTP in AMR (standalone gate enforcement)", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          ...makeStaffUser("admin"),
          factors: [],
          amr: [{ method: "password", timestamp: Math.floor(Date.now() / 1000) - 1800 }],
        },
      },
      error: null,
    });
    mockFrom.mockImplementation(
      vi.fn((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({ data: { status: "active" }, error: null }),
              })),
            })),
          };
        }
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn() })) })) };
      })
    );

    const result = await assertNotSuperAdminTarget("some-uuid");

    expect(result).toEqual({ ok: false, code: "mfa_required" });
  });

  it("returns not_allowed when caller has no staff role", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: makeStaffUser("admin") },
      error: null,
    });
    mockFrom.mockImplementation(
      vi.fn((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({ data: { status: "active" }, error: null }),
              })),
            })),
          };
        }
        if (table === "user_roles") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } }),
              })),
            })),
          };
        }
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn() })) })) };
      })
    );

    const result = await assertNotSuperAdminTarget("some-uuid");

    expect(result).toEqual({ ok: false, code: "not_allowed" });
  });

  it("returns not_allowed when a non-Super-Admin targets a Super Admin", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: makeStaffUser("admin") },
      error: null,
    });
    mockRpc.mockResolvedValueOnce({ data: true, error: null }); // profile_is_super_admin → true
    mockFrom.mockImplementation(
      vi.fn((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({ data: { status: "active" }, error: null }),
              })),
            })),
          };
        }
        if (table === "user_roles") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({ data: { role: "admin" }, error: null }),
              })),
            })),
          };
        }
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn() })) })) };
      })
    );

    const result = await assertNotSuperAdminTarget("target-sa-uuid");

    expect(result).toEqual({ ok: false, code: "not_allowed" });
  });

  it("passes when a Super Admin targets another Super Admin", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: makeStaffUser("super_admin") },
      error: null,
    });
    mockFrom.mockImplementation(
      vi.fn((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({ data: { status: "active" }, error: null }),
              })),
            })),
          };
        }
        if (table === "user_roles") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({ data: { role: "super_admin" }, error: null }),
              })),
            })),
          };
        }
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn() })) })) };
      })
    );
    mockRpc.mockResolvedValueOnce({ data: true, error: null }); // profile_is_super_admin → true

    const result = await assertNotSuperAdminTarget("target-sa-uuid");

    expect(result).toMatchObject({ ok: true });
  });

  it("passes when the target is not a Super Admin", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: makeStaffUser("admin") },
      error: null,
    });
    mockFrom.mockImplementation(
      vi.fn((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({ data: { status: "active" }, error: null }),
              })),
            })),
          };
        }
        if (table === "user_roles") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({ data: { role: "admin" }, error: null }),
              })),
            })),
          };
        }
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn() })) })) };
      })
    );
    mockRpc
      .mockResolvedValueOnce({ data: false, error: null }); // profile_is_super_admin → false (not SA)

    const result = await assertNotSuperAdminTarget("target-normal-uuid");

    expect(result).toMatchObject({ ok: true });
  });
});
