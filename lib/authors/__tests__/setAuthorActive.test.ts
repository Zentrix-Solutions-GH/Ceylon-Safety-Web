// S-052: AC3, EC2 — setAuthorActive

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({
  serverConfig: { supabaseServiceRoleKey: "srk" },
  publicConfig: { supabaseUrl: "https://test.supabase.co", supabaseAnonKey: "anon" },
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: vi.fn(),
}));
vi.mock("@/lib/auth/server", () => ({
  requireStaff: vi.fn(),
}));
vi.mock("@/lib/audit/index", () => ({
  writeAuditRow: vi.fn(),
}));
vi.mock("@/lib/ratelimit", () => ({
  checkAdminWriteLimit: vi.fn(),
}));
vi.mock("next/cache", () => ({
  unstable_noStore: vi.fn(),
}));

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/server";
import { writeAuditRow } from "@/lib/audit/index";
import { checkAdminWriteLimit } from "@/lib/ratelimit";
import { setAuthorActive } from "@/lib/authors/actions/setAuthorActive";

const STAFF = { id: "00000000-0000-4000-8000-000000000001", claimedRole: "admin" as const };
const AUTHOR_ID = "00000000-0000-4000-8000-000000000010";
const UPDATED_AT = "2026-01-01T00:00:00Z";

const EXISTING_ROW = {
  id: AUTHOR_ID,
  name: "Alice",
  slug: "alice",
  bio: null,
  is_active: true,
  updated_at: UPDATED_AT,
};

// Mock structure after atomic-update fix:
//   Call 1: .update().eq("id",...).eq("updated_at",...).select().single()
//           → returns updatedRow on success, or { code: "PGRST116" } on 0 rows
//   Call 2 (only on PGRST116): .select("id").eq("id",...).maybeSingle()
//           → returns { id } if author exists (version_conflict), null if not (not_found)
function buildMock({
  updatedRow = { ...EXISTING_ROW, is_active: false } as Record<string, unknown>,
  simulatePgrst116 = false,
  existsAfterPgrst116 = true,
} = {}) {
  let fromCount = 0;

  // Update chain: .update().eq().eq().select().single()
  const updateSingle = vi.fn().mockResolvedValue(
    simulatePgrst116
      ? { data: null, error: { code: "PGRST116" } }
      : { data: updatedRow, error: null }
  );
  const updateSelect = vi.fn().mockReturnValue({ single: updateSingle });
  const updateEq2 = vi.fn().mockReturnValue({ select: updateSelect, single: updateSingle });
  const updateEq1 = vi.fn().mockReturnValue({ eq: updateEq2 });
  const updateFn = vi.fn().mockReturnValue({ eq: updateEq1 });

  // Existence check: .select("id").eq("id",...).maybeSingle()
  const maybeSingle = vi.fn().mockResolvedValue({
    data: existsAfterPgrst116 ? { id: AUTHOR_ID } : null,
    error: null,
  });
  const existsEq = vi.fn().mockReturnValue({ maybeSingle });
  const existsSelect = vi.fn().mockReturnValue({ eq: existsEq });

  const supabase = {
    from: vi.fn().mockImplementation(() => {
      fromCount++;
      if (fromCount === 1) return { update: updateFn };
      return { select: existsSelect };
    }),
  };

  (createSupabaseServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(supabase);
  return { supabase, updateFn };
}

beforeEach(() => {
  vi.clearAllMocks();
  (writeAuditRow as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  (checkAdminWriteLimit as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
});

describe("setAuthorActive — AC3 deactivate", () => {
  it("deactivates an active author", async () => {
    (requireStaff as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, user: STAFF });
    buildMock({ updatedRow: { ...EXISTING_ROW, is_active: false } });

    const result = await setAuthorActive({ id: AUTHOR_ID, active: false, updatedAt: UPDATED_AT });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.author.isActive).toBe(false);
  });

  it("reactivates a deactivated author", async () => {
    (requireStaff as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, user: STAFF });
    buildMock({ updatedRow: { ...EXISTING_ROW, is_active: true } });

    const result = await setAuthorActive({ id: AUTHOR_ID, active: true, updatedAt: UPDATED_AT });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.author.isActive).toBe(true);
  });

  it("writes author.change audit row", async () => {
    (requireStaff as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, user: STAFF });
    buildMock();

    await setAuthorActive({ id: AUTHOR_ID, active: false, updatedAt: UPDATED_AT });
    expect(writeAuditRow).toHaveBeenCalledWith(
      expect.objectContaining({ action: "author.change" })
    );
  });
});

describe("setAuthorActive — EC2 no delete path", () => {
  it("only sets is_active, never deletes", async () => {
    (requireStaff as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, user: STAFF });
    const { updateFn } = buildMock();

    await setAuthorActive({ id: AUTHOR_ID, active: false, updatedAt: UPDATED_AT });
    expect(updateFn).toHaveBeenCalledWith({ is_active: false });
  });
});

describe("setAuthorActive — version conflict", () => {
  it("returns version_conflict when updated_at is stale", async () => {
    (requireStaff as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, user: STAFF });
    // Update returns 0 rows (PGRST116) because updated_at didn't match; author still exists.
    buildMock({ simulatePgrst116: true, existsAfterPgrst116: true });

    const result = await setAuthorActive({ id: AUTHOR_ID, active: false, updatedAt: UPDATED_AT });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("version_conflict");
  });

  it("returns not_found for unknown author id", async () => {
    (requireStaff as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, user: STAFF });
    // Update returns 0 rows; existence check also finds nothing.
    buildMock({ simulatePgrst116: true, existsAfterPgrst116: false });

    const result = await setAuthorActive({ id: "00000000-0000-4000-8000-000000000099", active: false, updatedAt: UPDATED_AT });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("not_found");
  });
});

describe("setAuthorActive — rate limit", () => {
  it("returns unknown when rate limit is exceeded", async () => {
    (requireStaff as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, user: STAFF });
    (checkAdminWriteLimit as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false });

    const result = await setAuthorActive({ id: AUTHOR_ID, active: false, updatedAt: UPDATED_AT });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("unknown");
  });
});
