// S-039: listStaff — AC6

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config.upstash", () => ({ upstashConfig: vi.fn().mockReturnValue(null) }));

vi.mock("@/lib/auth/server", () => ({
  requireSuperAdmin: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: vi.fn(),
}));

import { requireSuperAdmin } from "@/lib/auth/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { listStaff } from "@/lib/admin/actions/staff-roles";

const SUPER_ADMIN_USER = {
  id: "a0000000-0000-4000-8000-000000000001",
  email: "super@example.com",
  claimedRole: "super_admin" as const,
  hasAuthenticatorLevel: true,
  hasTotpEnrolled: true,
};

const STAFF_ROWS = [
  {
    user_id: "a0000000-0000-4000-8000-000000000010",
    role: "admin",
    profiles: { email: "admin@example.com", last_sign_in_at: "2026-11-01T10:00:00Z" },
  },
  {
    user_id: "a0000000-0000-4000-8000-000000000011",
    role: "editor",
    profiles: { email: "editor@example.com", last_sign_in_at: null },
  },
];

const AUTH_USERS: Record<string, { factors: { id: string; factor_type: string; status: string }[] }> = {
  "a0000000-0000-4000-8000-000000000010": { factors: [{ id: "f1", factor_type: "totp", status: "verified" }] },
  "a0000000-0000-4000-8000-000000000011": { factors: [] },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listStaff", () => {
  it("AC6: Super Admin gets list of admin and editor accounts", async () => {
    vi.mocked(requireSuperAdmin).mockResolvedValue({ ok: true, user: SUPER_ADMIN_USER });

    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: STAFF_ROWS, error: null }),
    });
    const mockGetUserById = vi.fn().mockImplementation(async (uid: string) => ({
      data: { user: AUTH_USERS[uid] ?? { factors: [] } },
      error: null,
    }));
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue({
      from: mockFrom,
      auth: { admin: { getUserById: mockGetUserById } },
    } as never);

    const result = await listStaff();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.staff).toHaveLength(2);
    expect(result.staff[0].role).toBe("admin");
    expect(result.staff[1].role).toBe("editor");
    expect(result.staff[0].hasTotpEnrolled).toBe(true);
    expect(result.staff[1].hasTotpEnrolled).toBe(false);
  });

  it("AC6: Admin calling listStaff gets not_allowed", async () => {
    vi.mocked(requireSuperAdmin).mockResolvedValue({ ok: false, code: "not_allowed" });

    const result = await listStaff();

    expect(result.ok).toBe(false);
    expect((result as { ok: false; code: string }).code).toBe("not_allowed");
  });

  it("AC6: super_admin rows are not returned in list (role filter asserted)", async () => {
    vi.mocked(requireSuperAdmin).mockResolvedValue({ ok: true, user: SUPER_ADMIN_USER });

    const mockIn = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockSelect = vi.fn().mockReturnValue({ in: mockIn });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue({
      from: mockFrom,
      auth: { admin: { getUserById: vi.fn() } },
    } as never);

    const result = await listStaff();

    expect(result.ok).toBe(true);
    // Assert the actual .in() call made during listStaff() filtered by admin+editor only
    expect(mockIn).toHaveBeenCalledWith("role", ["admin", "editor"]);
  });
});
