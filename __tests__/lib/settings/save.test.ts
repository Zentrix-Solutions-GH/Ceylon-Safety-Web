// S-099: saveSettingsGroup integration tests
// AC2, AC4, EC1, EC2, EC3, EC5, analyst-gap: updatedAt null
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
  createSupabaseServiceRoleClient: vi.fn(),
}));
vi.mock("@/lib/auth/server", () => ({
  requireStaff: vi.fn(),
}));
vi.mock("@/lib/settings/validation", () => ({
  validateGroup: vi.fn().mockImplementation((_group, values) => ({ ok: true, parsed: values })),
}));
vi.mock("@/lib/settings/audit", () => ({
  writeSettingsAuditRow: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/settings/bank", () => ({
  checkBankOrderPending: vi.fn().mockResolvedValue(false),
  enforceStepUpForBank: vi.fn().mockResolvedValue(undefined),
}));

import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/server";
import { validateGroup } from "@/lib/settings/validation";
import { checkBankOrderPending, enforceStepUpForBank } from "@/lib/settings/bank";
import { saveSettingsGroup } from "@/lib/settings/save";

const ADMIN_USER = { id: "admin-001", claimedRole: "admin" };
const SA_USER = { id: "sa-001", claimedRole: "super_admin" };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Chain = Record<string, (...args: any[]) => unknown>;

function makeServerDb(options?: {
  existingRows?: Array<{ key: string; value: unknown; updated_at: string }>;
  upsertError?: { code: string; message: string } | null;
}) {
  const rows = options?.existingRows ?? [];
  const upsertError = options?.upsertError ?? null;

  const upsertResult = Promise.resolve({ error: upsertError });

  const selectChain: Chain = {
    select: () => selectChain,
    eq: () => selectChain,
    in: () => selectChain,
    then(resolve: (v: unknown) => unknown) {
      return Promise.resolve({ data: rows, error: null }).then(resolve);
    },
    catch(reject: (e: unknown) => unknown) {
      return Promise.resolve({ data: rows, error: null }).catch(reject);
    },
  };

  return {
    from: (table: string) => {
      if (table === "site_settings") {
        return {
          select: () => selectChain,
          upsert: () => upsertResult,
        };
      }
      return { select: () => selectChain };
    },
  };
}

describe("saveSettingsGroup", () => {
  beforeEach(() => {
    vi.mocked(requireStaff).mockReset();
    vi.mocked(validateGroup).mockImplementation((_g, values) => ({ ok: true, parsed: values }));
    vi.mocked(checkBankOrderPending).mockResolvedValue(false);
    vi.mocked(enforceStepUpForBank).mockResolvedValue(undefined);
  });

  it("AC2: Admin can save site group", async () => {
    vi.mocked(requireStaff).mockResolvedValue({ ok: true, user: ADMIN_USER } as never);
    const rows = [{ key: "footer_business_name", value: "Old", updated_at: "2026-01-01T00:00:00Z" }];
    vi.mocked(createSupabaseServerClient).mockResolvedValue(
      makeServerDb({ existingRows: rows }) as never
    );
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(
      makeServerDb({ existingRows: rows }) as never
    );

    const result = await saveSettingsGroup({
      group: "site",
      values: { footer_business_name: "New" },
      updatedAt: "2026-01-01T00:00:00Z",
    });
    expect(result).toEqual({ ok: true });
    expect(requireStaff).toHaveBeenCalledWith("settings.site");
  });

  it("EC1: Admin cannot save contact group (not_allowed)", async () => {
    vi.mocked(requireStaff).mockResolvedValue({ ok: false, code: "not_allowed" } as never);

    const result = await saveSettingsGroup({
      group: "contact",
      values: { contact_email: "new@x.lk" },
      updatedAt: "2026-01-01T00:00:00Z",
    });
    expect(result).toEqual({ ok: false, code: "not_allowed" });
  });

  it("EC1: Admin cannot save business group (not_allowed)", async () => {
    vi.mocked(requireStaff).mockResolvedValue({ ok: false, code: "not_allowed" } as never);

    const result = await saveSettingsGroup({
      group: "business",
      values: { business_legal_name: "X" },
      updatedAt: "2026-01-01T00:00:00Z",
    });
    expect(result).toEqual({ ok: false, code: "not_allowed" });
  });

  it("AC2: Super Admin can save contact group", async () => {
    vi.mocked(requireStaff).mockResolvedValue({ ok: true, user: SA_USER } as never);
    const rows = [{ key: "contact_email", value: "old@x.lk", updated_at: "2026-01-01T00:00:00Z" }];
    vi.mocked(createSupabaseServerClient).mockResolvedValue(
      makeServerDb({ existingRows: rows }) as never
    );
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(
      makeServerDb({ existingRows: rows }) as never
    );

    const result = await saveSettingsGroup({
      group: "contact",
      values: { contact_email: "new@x.lk" },
      updatedAt: "2026-01-01T00:00:00Z",
    });
    expect(result).toEqual({ ok: true });
  });

  it("AC4: version_conflict when updatedAt doesn't match", async () => {
    vi.mocked(requireStaff).mockResolvedValue({ ok: true, user: SA_USER } as never);
    const rows = [
      { key: "contact_email", value: "old@x.lk", updated_at: "2026-02-01T00:00:00Z" }, // newer
    ];
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(
      makeServerDb({ existingRows: rows }) as never
    );

    const result = await saveSettingsGroup({
      group: "contact",
      values: { contact_email: "new@x.lk" },
      updatedAt: "2026-01-01T00:00:00Z", // stale
    });
    expect(result).toEqual({ ok: false, code: "version_conflict" });
  });

  it("EC2: second concurrent save gets version_conflict", async () => {
    vi.mocked(requireStaff).mockResolvedValue({ ok: true, user: SA_USER } as never);
    // First save succeeds; second caller sends old updatedAt
    const rows = [{ key: "footer_business_name", value: "v1", updated_at: "2026-01-02T00:00:00Z" }];
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(
      makeServerDb({ existingRows: rows }) as never
    );

    const result = await saveSettingsGroup({
      group: "site",
      values: { footer_business_name: "v2" },
      updatedAt: "2026-01-01T00:00:00Z",
    });
    expect(result).toEqual({ ok: false, code: "version_conflict" });
  });

  it("analyst-gap: updatedAt null is treated as first write (always conflicts if row exists)", async () => {
    vi.mocked(requireStaff).mockResolvedValue({ ok: true, user: SA_USER } as never);
    const rows = [{ key: "contact_email", value: "old@x.lk", updated_at: "2026-01-01T00:00:00Z" }];
    vi.mocked(createSupabaseServerClient).mockResolvedValue(
      makeServerDb({ existingRows: rows }) as never
    );

    const result = await saveSettingsGroup({
      group: "contact",
      values: { contact_email: "new@x.lk" },
      updatedAt: null,
    });
    expect(result).toEqual({ ok: false, code: "version_conflict" });
  });

  it("AC3: validation_failed returned when validateGroup fails", async () => {
    vi.mocked(requireStaff).mockResolvedValue({ ok: true, user: ADMIN_USER } as never);
    vi.mocked(validateGroup).mockReturnValue({ ok: false, field: "footer_business_name" });

    const result = await saveSettingsGroup({
      group: "site",
      values: { footer_business_name: "X".repeat(201) },
      updatedAt: "2026-01-01T00:00:00Z",
    });
    expect(result).toEqual({ ok: false, code: "validation_failed", field: "footer_business_name" });
  });

  it("AC5: bank group save without code returns mfa_required", async () => {
    vi.mocked(requireStaff).mockResolvedValue({ ok: true, user: SA_USER } as never);
    vi.mocked(enforceStepUpForBank).mockRejectedValue(
      Object.assign(new Error("mfa_required"), { code: "mfa_required" })
    );

    const result = await saveSettingsGroup({
      group: "business",
      values: { bank_account_details: "00012345678" },
      updatedAt: "2026-01-01T00:00:00Z",
    });
    expect(result).toEqual({ ok: false, code: "mfa_required" });
  });

  it("EC3: bank_account_details emptied while order pending — validation_failed bank_order_pending", async () => {
    vi.mocked(requireStaff).mockResolvedValue({ ok: true, user: SA_USER } as never);
    vi.mocked(enforceStepUpForBank).mockResolvedValue(undefined);
    vi.mocked(checkBankOrderPending).mockResolvedValue(true);

    const result = await saveSettingsGroup({
      group: "business",
      values: { bank_account_details: null },
      updatedAt: "2026-01-01T00:00:00Z",
      code: "123456",
    });
    expect(result).toEqual({
      ok: false,
      code: "validation_failed",
      reason: "bank_order_pending",
    });
  });

  it("edge: empty values object skips DB and returns ok:true", async () => {
    vi.mocked(requireStaff).mockResolvedValue({ ok: true, user: ADMIN_USER } as never);
    vi.mocked(createSupabaseServiceRoleClient).mockClear();
    // No DB mock needed — the early-return at keys.length === 0 must fire before any DB call.
    const result = await saveSettingsGroup({
      group: "site",
      values: {},
      updatedAt: null,
    });
    expect(result).toEqual({ ok: true });
    expect(createSupabaseServiceRoleClient).not.toHaveBeenCalled();
  });

  it("EC5: bulk_contact_phone null is accepted for site group", async () => {
    vi.mocked(requireStaff).mockResolvedValue({ ok: true, user: ADMIN_USER } as never);
    const rows = [{ key: "bulk_contact_phone", value: "+94 11 000 0000", updated_at: "2026-01-01T00:00:00Z" }];
    vi.mocked(createSupabaseServerClient).mockResolvedValue(
      makeServerDb({ existingRows: rows }) as never
    );
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(
      makeServerDb({ existingRows: rows }) as never
    );

    const result = await saveSettingsGroup({
      group: "site",
      values: { bulk_contact_phone: null },
      updatedAt: "2026-01-01T00:00:00Z",
    });
    expect(result).toEqual({ ok: true });
  });
});
