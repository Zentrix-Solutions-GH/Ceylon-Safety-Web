import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetUser = vi.fn();
const mockRpc = vi.fn();
const mockFrom = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    rpc: mockRpc,
    from: mockFrom,
  })),
  createSupabaseServiceRoleClient: vi.fn(() => ({
    rpc: mockRpc,
  })),
}));
vi.mock("@/lib/audit", () => ({
  writeAuditRow: vi.fn().mockResolvedValue(undefined),
  writeDenied: vi.fn().mockResolvedValue(undefined),
}));

import { requireStaff, requireSuperAdmin, requireStaffNoMfa } from "@/lib/auth/server";
import { writeDenied } from "@/lib/audit";

const NOW_ISO = new Date().toISOString();

// A full sign-in 1 hour ago — within the 12-hour window
const RECENT_SIGNIN = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();

// A sign-in 13 hours ago — outside the 12-hour window
const OLD_SIGNIN = new Date(Date.now() - 13 * 60 * 60 * 1000).toISOString();

function makeUser(overrides: object = {}) {
  return {
    id: "staff-1",
    email: "admin@example.com",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: NOW_ISO,
    last_sign_in_at: RECENT_SIGNIN,
    factors: [{ factor_type: "totp", status: "verified" }],
    amr: [
      { method: "password", timestamp: Math.floor(Date.now() / 1000) - 3600 },
      { method: "totp", timestamp: Math.floor(Date.now() / 1000) - 3600 },
    ],
    ...overrides,
  };
}

function makeFromMock(profileStatus: string, role: string | null) {
  return vi.fn((table: string) => {
    if (table === "profiles") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: { id: "staff-1", status: profileStatus },
              error: null,
            }),
          })),
        })),
      };
    }
    if (table === "user_roles") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: role ? { user_id: "staff-1", role } : null,
              error: role ? null : { code: "PGRST116" },
            }),
          })),
        })),
      };
    }
    return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn() })) })) };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requireStaff", () => {
  it("returns ok for an Admin with a seeded permission (AC4)", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: makeUser() },
      error: null,
    });
    mockFrom.mockImplementation(makeFromMock("active", "admin"));
    mockRpc.mockResolvedValue({ data: true, error: null }); // has_permission → true

    const result = await requireStaff("articles.publish");

    expect(result).toMatchObject({ ok: true });
  });

  it("returns not_allowed when Admin has no permission for the action (AC4)", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: makeUser() },
      error: null,
    });
    mockFrom.mockImplementation(makeFromMock("active", "admin"));
    mockRpc.mockResolvedValue({ data: false, error: null }); // has_permission → false

    const result = await requireStaff("orders.grant");

    expect(result).toEqual({ ok: false, code: "not_allowed" });
  });

  it("returns not_allowed for a Maintainer with no permissions (AC4, EC1)", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: makeUser() },
      error: null,
    });
    mockFrom.mockImplementation(makeFromMock("active", "editor"));
    mockRpc.mockResolvedValue({ data: false, error: null });

    const result = await requireStaff("articles.publish");

    expect(result).toEqual({ ok: false, code: "not_allowed" });
  });

  it("refuses a user whose staff row was removed even if token said admin (EC1)", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: makeUser() },
      error: null,
    });
    mockFrom.mockImplementation(makeFromMock("active", null)); // no DB row

    const result = await requireStaff("articles.publish");

    expect(result).toEqual({ ok: false, code: "not_allowed" });
  });

  it("returns reauth_required when session is older than 12h (AC5)", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: makeUser({
          last_sign_in_at: OLD_SIGNIN,
          amr: [
            { method: "password", timestamp: Math.floor(Date.now() / 1000) - 13 * 3600 },
            { method: "totp", timestamp: Math.floor(Date.now() / 1000) - 13 * 3600 },
          ],
        }),
      },
      error: null,
    });
    mockFrom.mockImplementation(makeFromMock("active", "admin"));

    const result = await requireStaff("articles.publish");

    expect(result).toEqual({ ok: false, code: "reauth_required" });
  });

  it("returns mfa_required when user has no TOTP factor (AC5)", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: makeUser({
          factors: [],
          amr: [{ method: "password", timestamp: Math.floor(Date.now() / 1000) - 3600 }],
        }),
      },
      error: null,
    });
    mockFrom.mockImplementation(makeFromMock("active", "admin"));

    const result = await requireStaff("articles.publish");

    expect(result).toEqual({ ok: false, code: "mfa_required" });
  });

  it("returns mfa_required when session is not at authenticator level (no totp in amr) (AC5)", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: makeUser({
          factors: [{ factor_type: "totp", status: "verified" }],
          amr: [{ method: "password", timestamp: Math.floor(Date.now() / 1000) - 3600 }],
        }),
      },
      error: null,
    });
    mockFrom.mockImplementation(makeFromMock("active", "admin"));

    const result = await requireStaff("articles.publish");

    expect(result).toEqual({ ok: false, code: "mfa_required" });
  });
});

describe("requireSuperAdmin", () => {
  it("passes for a Super Admin with TOTP and fresh session", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: makeUser() },
      error: null,
    });
    mockFrom.mockImplementation(makeFromMock("active", "super_admin"));
    mockRpc.mockResolvedValue({ data: true, error: null });

    const result = await requireSuperAdmin();

    expect(result).toMatchObject({ ok: true });
  });

  it("returns not_allowed for an Admin calling requireSuperAdmin", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: makeUser() },
      error: null,
    });
    mockFrom.mockImplementation(makeFromMock("active", "admin"));

    const result = await requireSuperAdmin();

    expect(result).toEqual({ ok: false, code: "not_allowed" });
  });

  it("EC4: calls writeDenied when non-SA caller is rejected (permission.denied audit)", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: makeUser() },
      error: null,
    });
    mockFrom.mockImplementation(makeFromMock("active", "admin"));

    await requireSuperAdmin();

    expect(vi.mocked(writeDenied)).toHaveBeenCalledWith(
      "staff-1",
      "staff_action",
      "super_admin_required"
    );
  });
});

describe("requireStaffNoMfa (AC6 — lower-level variant)", () => {
  it("passes for staff with a valid role but no TOTP in AMR", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: makeUser({
          factors: [],
          amr: [{ method: "password", timestamp: Math.floor(Date.now() / 1000) - 3600 }],
        }),
      },
      error: null,
    });
    mockFrom.mockImplementation(makeFromMock("active", "admin"));

    const result = await requireStaffNoMfa();

    expect(result).toMatchObject({ ok: true });
  });

  it("still requires a staff role", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: makeUser() },
      error: null,
    });
    mockFrom.mockImplementation(makeFromMock("active", null));

    const result = await requireStaffNoMfa();

    expect(result).toEqual({ ok: false, code: "not_allowed" });
  });
});

describe("requireStaff — EC2: role in user_metadata grants nothing", () => {
  it("returns not_allowed when user_metadata has a role claim but no user_roles DB row", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: makeUser({
          user_metadata: { role: "admin" }, // should be ignored
        }),
      },
      error: null,
    });
    // No DB row for user_roles
    mockFrom.mockImplementation(makeFromMock("active", null));

    const result = await requireStaff("articles.publish");

    expect(result).toEqual({ ok: false, code: "not_allowed" });
  });
});
