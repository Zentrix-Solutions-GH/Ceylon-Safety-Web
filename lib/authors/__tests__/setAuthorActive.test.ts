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

// Build a supabase mock where from() always returns the same chain.
// The chain distinguishes fetch (select path) vs update (update path)
// by which method is called first after from().
function buildMock({
  existingRow = EXISTING_ROW as Record<string, unknown> | null,
  updatedRow = { ...EXISTING_ROW, is_active: false } as Record<string, unknown>,
} = {}) {
  // --- Update path: .update({}).eq(...).select(...).single() ---
  const updateSingle = vi.fn().mockResolvedValue({ data: updatedRow, error: null });
  const updateSelect = vi.fn().mockReturnValue({ single: updateSingle });
  const updateEq = vi.fn().mockReturnValue({ select: updateSelect, single: updateSingle });
  const updateFn = vi.fn().mockReturnValue({ eq: updateEq });

  // --- Fetch path: .select(...).eq(...).single() ---
  const fetchSingle = vi.fn().mockResolvedValue({
    data: existingRow,
    error: existingRow ? null : { code: "PGRST116" },
  });
  const fetchEq = vi.fn().mockReturnValue({ single: fetchSingle });
  const fetchSelect = vi.fn().mockReturnValue({ eq: fetchEq, single: fetchSingle });

  // Single chain returned by every from() call; methods route to their own sub-chains
  const chain = {
    select: fetchSelect,
    update: updateFn,
  };

  const supabase = { from: vi.fn().mockReturnValue(chain) };
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
    buildMock({
      existingRow: { ...EXISTING_ROW, is_active: false },
      updatedRow: { ...EXISTING_ROW, is_active: true },
    });

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
    buildMock({ existingRow: { ...EXISTING_ROW, updated_at: "2026-02-01T00:00:00Z" } });

    const result = await setAuthorActive({ id: AUTHOR_ID, active: false, updatedAt: UPDATED_AT });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("version_conflict");
  });

  it("returns not_found for unknown author id", async () => {
    (requireStaff as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, user: STAFF });
    buildMock({ existingRow: null });

    const result = await setAuthorActive({ id: "00000000-0000-4000-8000-000000000099", active: false, updatedAt: UPDATED_AT });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("not_found");
  });
});
