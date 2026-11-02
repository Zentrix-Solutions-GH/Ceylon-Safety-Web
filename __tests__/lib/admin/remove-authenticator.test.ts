// S-039: removeAuthenticator — AC5

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config.upstash", () => ({ upstashConfig: vi.fn().mockReturnValue(null) }));

vi.mock("@/lib/auth/server", () => ({
  requireSuperAdmin: vi.fn(),
}));
vi.mock("@/lib/auth/step-up", () => ({
  requireStepUp: vi.fn(),
}));
vi.mock("@/lib/audit/index", () => ({
  writeAuditRow: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: vi.fn(),
}));

import { requireSuperAdmin } from "@/lib/auth/server";
import { requireStepUp } from "@/lib/auth/step-up";
import { writeAuditRow } from "@/lib/audit/index";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { removeAuthenticator } from "@/lib/admin/actions/remove-authenticator";

const SUPER_ADMIN_USER = {
  id: "a0000000-0000-4000-8000-000000000001",
  email: "super@example.com",
  claimedRole: "super_admin" as const,
  hasAuthenticatorLevel: true,
  hasTotpEnrolled: true,
};

const TARGET_UUID = "a0000000-0000-4000-8000-000000000002";

function makeClient(opts: {
  roleRow?: { data: unknown; error: unknown };
  authUser?: { id: string; factors?: { id: string; factor_type: string; status: string }[] } | null;
  deleteFactor?: { error: unknown };
} = {}) {
  const roleRow = opts.roleRow ?? { data: { role: "admin" }, error: null };
  const authUser = opts.authUser !== undefined ? opts.authUser : {
    id: TARGET_UUID,
    factors: [{ id: "factor-1", factor_type: "totp", status: "verified" }],
  };
  const deleteFactorErr = opts.deleteFactor?.error ?? null;

  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue(roleRow),
    }),
    auth: {
      admin: {
        getUserById: vi.fn().mockResolvedValue({ data: { user: authUser }, error: null }),
        mfa: {
          deleteFactor: vi.fn().mockResolvedValue({ error: deleteFactorErr }),
        },
      },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireStepUp).mockResolvedValue(undefined);
});

describe("removeAuthenticator", () => {
  it("AC5: removes authenticator for an admin target, writes audit row", async () => {
    vi.mocked(requireSuperAdmin).mockResolvedValue({ ok: true, user: SUPER_ADMIN_USER });
    const client = makeClient();
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(client as never);

    const result = await removeAuthenticator({
      userId: TARGET_UUID,
      reason: "locked out",
      totpCode: "123456",
    });

    expect(result.ok).toBe(true);
    expect(client.auth.admin.mfa.deleteFactor).toHaveBeenCalledWith({ userId: TARGET_UUID, id: "factor-1" });
    expect(writeAuditRow).toHaveBeenCalledWith(expect.objectContaining({ action: "user.remove_mfa" }));
  });

  it("AC5: removes authenticator for an editor target", async () => {
    vi.mocked(requireSuperAdmin).mockResolvedValue({ ok: true, user: SUPER_ADMIN_USER });
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(
      makeClient({ roleRow: { data: { role: "editor" }, error: null } }) as never
    );

    const result = await removeAuthenticator({
      userId: TARGET_UUID,
      reason: "lost phone",
      totpCode: "123456",
    });

    expect(result.ok).toBe(true);
    expect(writeAuditRow).toHaveBeenCalled();
  });

  it("AC5: refused for a Super Admin target", async () => {
    vi.mocked(requireSuperAdmin).mockResolvedValue({ ok: true, user: SUPER_ADMIN_USER });
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(
      makeClient({ roleRow: { data: { role: "super_admin" }, error: null } }) as never
    );

    const result = await removeAuthenticator({
      userId: "a0000000-0000-4000-8000-000000000003",
      reason: "test",
      totpCode: "123456",
    });

    expect(result.ok).toBe(false);
    expect((result as { ok: false; code: string }).code).toBe("not_allowed");
    expect(writeAuditRow).not.toHaveBeenCalled();
  });

  it("AC5: non-Super-Admin caller gets not_allowed", async () => {
    vi.mocked(requireSuperAdmin).mockResolvedValue({ ok: false, code: "not_allowed" });

    const result = await removeAuthenticator({
      userId: TARGET_UUID,
      reason: "test",
      totpCode: "123456",
    });

    expect(result.ok).toBe(false);
    expect((result as { ok: false; code: string }).code).toBe("not_allowed");
  });

  it("AC5: target not found returns not_found", async () => {
    vi.mocked(requireSuperAdmin).mockResolvedValue({ ok: true, user: SUPER_ADMIN_USER });
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(
      makeClient({ roleRow: { data: null, error: { code: "PGRST116" } } }) as never
    );

    const result = await removeAuthenticator({
      userId: "a0000000-0000-4000-8000-000000000099",
      reason: "test",
      totpCode: "123456",
    });

    expect(result.ok).toBe(false);
    expect((result as { ok: false; code: string }).code).toBe("not_found");
  });
});
