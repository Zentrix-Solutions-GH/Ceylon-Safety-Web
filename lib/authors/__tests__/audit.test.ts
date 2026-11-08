// S-052: AC2, AC3 — audit rows

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
import { saveAuthor } from "@/lib/authors/actions/saveAuthor";
import { setAuthorActive } from "@/lib/authors/actions/setAuthorActive";

const STAFF = { id: "00000000-0000-4000-8000-000000000001", claimedRole: "admin" as const };
const AUTHOR_ID = "00000000-0000-4000-8000-000000000010";
const UPDATED_AT = "2026-01-01T00:00:00Z";

const SAVED_ROW = {
  id: AUTHOR_ID,
  name: "Alice",
  slug: "alice",
  bio: null,
  is_active: true,
  updated_at: UPDATED_AT,
};

function setupSaveMock() {
  const single = vi.fn().mockResolvedValue({ data: SAVED_ROW, error: null });
  const select = vi.fn().mockReturnValue({ single });
  const dmlChain = { insert: vi.fn().mockReturnValue({ select, single }) };

  const slugEq = vi.fn().mockResolvedValue({ data: [], error: null });
  const slugChain = { select: vi.fn().mockReturnValue({ eq: slugEq }) };

  let callCount = 0;
  (createSupabaseServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue({
    from: vi.fn().mockImplementation(() => {
      callCount++;
      return callCount === 1 ? slugChain : dmlChain;
    }),
  });
}

function setupActiveMock() {
  const updatedRow = { id: AUTHOR_ID, name: "Alice", slug: "alice", bio: null, is_active: false, updated_at: UPDATED_AT };

  // After atomic-update fix: .update().eq("id",...).eq("updated_at",...).select().single()
  const updateSingle = vi.fn().mockResolvedValue({ data: updatedRow, error: null });
  const updateSelect = vi.fn().mockReturnValue({ single: updateSingle });
  const updateEq2 = vi.fn().mockReturnValue({ select: updateSelect, single: updateSingle });
  const updateEq1 = vi.fn().mockReturnValue({ eq: updateEq2 });
  const updateFn = vi.fn().mockReturnValue({ eq: updateEq1 });

  (createSupabaseServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue({
    from: vi.fn().mockReturnValue({ update: updateFn }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  (writeAuditRow as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  (checkAdminWriteLimit as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
  (requireStaff as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, user: STAFF });
});

describe("audit rows", () => {
  it("saveAuthor create writes author.change with entityId = new author id", async () => {
    setupSaveMock();
    await saveAuthor({ name: "Alice" });

    expect(writeAuditRow).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "author.change",
        actorId: STAFF.id,
        entityType: "author",
        entityId: AUTHOR_ID,
      })
    );
  });

  it("setAuthorActive writes author.change with correct entity", async () => {
    setupActiveMock();
    await setAuthorActive({ id: AUTHOR_ID, active: false, updatedAt: UPDATED_AT });

    expect(writeAuditRow).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "author.change",
        actorId: STAFF.id,
        entityType: "author",
        entityId: AUTHOR_ID,
      })
    );
  });
});
