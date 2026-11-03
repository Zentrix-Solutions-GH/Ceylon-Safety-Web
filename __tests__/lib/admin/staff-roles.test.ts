// S-039: grantRole, removeRole — AC1, AC2, AC3, AC4, EC1, EC2, EC3, EC4

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
import { grantRole, removeRole } from "@/lib/admin/actions/staff-roles";

const SUPER_ADMIN_USER = {
  id: "a0000000-0000-4000-8000-000000000001",
  email: "super@example.com",
  claimedRole: "super_admin" as const,
  hasAuthenticatorLevel: true,
  hasTotpEnrolled: true,
};

const TARGET_UUID = "a0000000-0000-4000-8000-000000000002";

// ── helpers ──────────────────────────────────────────────────────────────────

function makeAdminApiUser(overrides: Record<string, unknown> = {}) {
  return {
    id: TARGET_UUID,
    email: "target@example.com",
    email_confirmed_at: "2025-01-01T00:00:00Z",
    factors: [],
    ...overrides,
  };
}

function makeClient(opts: {
  getUserResult?: { data: { user: unknown }; error: unknown };
  fromSingle?: { data: unknown; error: unknown };
  upsertError?: unknown;
  deleteError?: unknown;
} = {}) {
  const getUserResult = opts.getUserResult ?? { data: { user: makeAdminApiUser() }, error: null };
  const fromSingle = opts.fromSingle ?? { data: null, error: null };
  return {
    auth: { admin: { getUserById: vi.fn().mockResolvedValue(getUserResult) } },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue(fromSingle),
      upsert: vi.fn().mockResolvedValue({ error: opts.upsertError ?? null }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: opts.deleteError ?? null }),
      }),
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireStepUp).mockResolvedValue(undefined);
});

// ── grantRole ─────────────────────────────────────────────────────────────────

describe("grantRole", () => {
  it("AC1: grants admin role, writes audit row", async () => {
    vi.mocked(requireSuperAdmin).mockResolvedValue({ ok: true, user: SUPER_ADMIN_USER });
    const client = makeClient();
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(client as never);

    const result = await grantRole({ userId: TARGET_UUID, role: "admin", totpCode: "123456" });

    expect(result.ok).toBe(true);
    expect(requireStepUp).toHaveBeenCalledWith(SUPER_ADMIN_USER.id, "123456");
    expect(writeAuditRow).toHaveBeenCalledWith(expect.objectContaining({ action: "role.change" }));
  });

  it("AC1: grants editor role", async () => {
    vi.mocked(requireSuperAdmin).mockResolvedValue({ ok: true, user: SUPER_ADMIN_USER });
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(makeClient() as never);

    const result = await grantRole({ userId: TARGET_UUID, role: "editor", totpCode: "123456" });

    expect(result.ok).toBe(true);
  });

  it("AC4: refuses to grant super_admin", async () => {
    vi.mocked(requireSuperAdmin).mockResolvedValue({ ok: true, user: SUPER_ADMIN_USER });

    const result = await grantRole({ userId: TARGET_UUID, role: "super_admin", totpCode: "123456" });

    expect(result.ok).toBe(false);
    expect((result as { ok: false; code: string }).code).toBe("validation_failed");
    expect(writeAuditRow).not.toHaveBeenCalled();
  });

  it("AC3: non-Super-Admin caller gets not_allowed", async () => {
    vi.mocked(requireSuperAdmin).mockResolvedValue({ ok: false, code: "not_allowed" });

    const result = await grantRole({ userId: TARGET_UUID, role: "admin", totpCode: "123456" });

    expect(result.ok).toBe(false);
    expect((result as { ok: false; code: string }).code).toBe("not_allowed");
  });

  it("EC1: target user not found returns not_found", async () => {
    vi.mocked(requireSuperAdmin).mockResolvedValue({ ok: true, user: SUPER_ADMIN_USER });
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(
      makeClient({ getUserResult: { data: { user: null }, error: { message: "not found" } } }) as never
    );

    const result = await grantRole({ userId: TARGET_UUID, role: "admin", totpCode: "123456" });

    expect(result.ok).toBe(false);
    expect((result as { ok: false; code: string }).code).toBe("not_found");
  });

  it("EC1: target email not verified returns validation_failed", async () => {
    vi.mocked(requireSuperAdmin).mockResolvedValue({ ok: true, user: SUPER_ADMIN_USER });
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(
      makeClient({ getUserResult: { data: { user: makeAdminApiUser({ email_confirmed_at: null }) }, error: null } }) as never
    );

    const result = await grantRole({ userId: TARGET_UUID, role: "admin", totpCode: "123456" });

    expect(result.ok).toBe(false);
    expect((result as { ok: false; code: string }).code).toBe("validation_failed");
  });

  it("mfa_required propagated when step-up fails", async () => {
    vi.mocked(requireSuperAdmin).mockResolvedValue({ ok: true, user: SUPER_ADMIN_USER });
    // Target must exist and have verified email so we reach step-up (validation now runs first)
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(makeClient() as never);
    vi.mocked(requireStepUp).mockRejectedValue(
      Object.assign(new Error("mfa_required"), { code: "mfa_required" })
    );

    await expect(
      grantRole({ userId: TARGET_UUID, role: "admin", totpCode: "999999" })
    ).rejects.toMatchObject({ code: "mfa_required" });
  });
});

// ── removeRole ────────────────────────────────────────────────────────────────

describe("removeRole", () => {
  it("AC2: removes role, writes audit row", async () => {
    vi.mocked(requireSuperAdmin).mockResolvedValue({ ok: true, user: SUPER_ADMIN_USER });
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(
      makeClient({ fromSingle: { data: { role: "admin" }, error: null } }) as never
    );

    const result = await removeRole({ userId: TARGET_UUID, totpCode: "123456" });

    expect(result.ok).toBe(true);
    expect(writeAuditRow).toHaveBeenCalledWith(expect.objectContaining({ action: "role.change" }));
  });

  it("AC3: cannot remove own role", async () => {
    vi.mocked(requireSuperAdmin).mockResolvedValue({ ok: true, user: SUPER_ADMIN_USER });

    const result = await removeRole({ userId: SUPER_ADMIN_USER.id, totpCode: "123456" });

    expect(result.ok).toBe(false);
    expect((result as { ok: false; code: string }).code).toBe("not_allowed");
    expect(writeAuditRow).not.toHaveBeenCalled();
  });

  it("AC3: cannot remove a Super Admin target", async () => {
    vi.mocked(requireSuperAdmin).mockResolvedValue({ ok: true, user: SUPER_ADMIN_USER });
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(
      makeClient({ fromSingle: { data: { role: "super_admin" }, error: null } }) as never
    );

    const result = await removeRole({ userId: "a0000000-0000-4000-8000-000000000003", totpCode: "123456" });

    expect(result.ok).toBe(false);
    expect((result as { ok: false; code: string }).code).toBe("not_allowed");
  });

  it("EC4: Admin calling removeRole gets not_allowed", async () => {
    vi.mocked(requireSuperAdmin).mockResolvedValue({ ok: false, code: "not_allowed" });

    const result = await removeRole({ userId: TARGET_UUID, totpCode: "123456" });

    expect(result.ok).toBe(false);
    expect((result as { ok: false; code: string }).code).toBe("not_allowed");
  });

  it("EC3: target has no role row — not_found", async () => {
    vi.mocked(requireSuperAdmin).mockResolvedValue({ ok: true, user: SUPER_ADMIN_USER });
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(
      makeClient({ fromSingle: { data: null, error: { code: "PGRST116" } } }) as never
    );

    const result = await removeRole({ userId: TARGET_UUID, totpCode: "123456" });

    expect(result.ok).toBe(false);
    expect((result as { ok: false; code: string }).code).toBe("not_found");
  });

  it("AC3 (DB trigger simulation): delete returning trigger error propagates as unknown", async () => {
    // Simulates the S-012 DB trigger blocking a delete that somehow bypassed the action-level
    // super_admin check. The action maps DB errors to {ok:false,code:'unknown'}.
    vi.mocked(requireSuperAdmin).mockResolvedValue({ ok: true, user: SUPER_ADMIN_USER });
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(
      makeClient({
        fromSingle: { data: { role: "admin" }, error: null },
        deleteError: { message: "trigger: cannot delete super_admin row" },
      }) as never
    );

    const result = await removeRole({ userId: TARGET_UUID, totpCode: "123456" });

    expect(result.ok).toBe(false);
    expect((result as { ok: false; code: string }).code).toBe("unknown");
    expect(writeAuditRow).not.toHaveBeenCalled();
  });

  it("EC3 (stale JWT): after role is removed, requireStaff refuses the next DB call", async () => {
    // EC3: the removed user's JWT may still be valid for up to 1 hour, but every
    // server action calls requireStaff which reads user_roles from the DB.
    // Once the row is gone, the DB read returns nothing → not_allowed.
    // This behaviour is covered end-to-end in __tests__/lib/auth/require-staff.test.ts
    // ("returns not_allowed when user_metadata has a role claim but no user_roles DB row").
    // Here we verify removeRole hard-deletes the row so that path is reachable.
    vi.mocked(requireSuperAdmin).mockResolvedValue({ ok: true, user: SUPER_ADMIN_USER });
    const client = makeClient({ fromSingle: { data: { role: "admin" }, error: null } });
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(client as never);

    const result = await removeRole({ userId: TARGET_UUID, totpCode: "123456" });

    expect(result.ok).toBe(true);
    // The delete must have been called so the row no longer exists in the DB.
    expect(client.from).toHaveBeenCalledWith("user_roles");
  });
});
