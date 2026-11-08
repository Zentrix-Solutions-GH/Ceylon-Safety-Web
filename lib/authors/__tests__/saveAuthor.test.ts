// S-052: AC2, AC4, EC1, EC3, EC4, EC5 — saveAuthor

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

const STAFF = { id: "00000000-0000-4000-8000-000000000001", claimedRole: "admin" as const };
const AUTHOR_ID = "00000000-0000-4000-8000-000000000010";
const UPDATED_AT = "2026-01-01T00:00:00Z";

const SAVED_ROW = {
  id: AUTHOR_ID,
  name: "Alice Smith",
  slug: "alice-smith",
  bio: null,
  is_active: true,
  updated_at: "2026-01-02T00:00:00Z",
};

function makeDmlChain(savedRow: Record<string, unknown>) {
  const single = vi.fn().mockResolvedValue({ data: savedRow, error: null });
  const select = vi.fn().mockReturnValue({ single });
  const eq = vi.fn().mockReturnValue({ select, single });
  return { insert: vi.fn().mockReturnValue({ select, single }), update: vi.fn().mockReturnValue({ eq }), select, single, eq };
}

function makeSlugChain(rows: { id: string }[]) {
  const eq = vi.fn().mockResolvedValue({ data: rows, error: null });
  const select = vi.fn().mockReturnValue({ eq });
  return { select };
}

function makeFetchChain(existingRow: Record<string, unknown> | null) {
  const single = vi.fn().mockResolvedValue({
    data: existingRow,
    error: existingRow ? null : { code: "PGRST116" },
  });
  const eq = vi.fn().mockReturnValue({ single });
  const select = vi.fn().mockReturnValue({ eq, single });
  return { select };
}

// Action call order for create: (1) slug check → (2) insert
// Action call order for update: (1) version fetch → (2) slug check → (3) update
function setupMock({
  slugRows = [] as { id: string }[],
  savedRow = SAVED_ROW as Record<string, unknown>,
  existingRow = undefined as Record<string, unknown> | null | undefined,
} = {}) {
  const isUpdate = existingRow !== undefined;
  let callCount = 0;
  const dmlChain = makeDmlChain(savedRow);
  const slugChain = makeSlugChain(slugRows);
  const fetchChain = isUpdate ? makeFetchChain(existingRow!) : null;

  const supabase = {
    from: vi.fn().mockImplementation(() => {
      callCount++;
      if (isUpdate) {
        if (callCount === 1) return fetchChain; // version check
        if (callCount === 2) return slugChain;  // slug check
        return dmlChain;                        // update DML
      }
      // create
      if (callCount === 1) return slugChain;    // slug check
      return dmlChain;                          // insert DML
    }),
  };
  (createSupabaseServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(supabase);
  return supabase;
}

beforeEach(() => {
  vi.clearAllMocks();
  (writeAuditRow as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  (checkAdminWriteLimit as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
});

describe("saveAuthor — AC2 create", () => {
  it("creates a new author and returns Author row", async () => {
    (requireStaff as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, user: STAFF });
    setupMock();

    const result = await saveAuthor({ name: "Alice Smith" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.author.name).toBe("Alice Smith");
    expect(result.author.slug).toBe("alice-smith");
  });

  it("generates slug from name", async () => {
    (requireStaff as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, user: STAFF });
    setupMock({ savedRow: { ...SAVED_ROW, slug: "john-doe" } });

    const result = await saveAuthor({ name: "John Doe" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.author.slug).toBe("john-doe");
  });

  it("writes author.change audit row (AC2)", async () => {
    (requireStaff as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, user: STAFF });
    setupMock();

    await saveAuthor({ name: "Alice Smith" });
    expect(writeAuditRow).toHaveBeenCalledWith(
      expect.objectContaining({ action: "author.change" })
    );
  });
});

describe("saveAuthor — EC1 slug collision", () => {
  it("appends -1 suffix when slug already exists for another author", async () => {
    (requireStaff as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, user: STAFF });

    const clashRow = { id: "other-author-id" };
    const savedWithSuffix = { ...SAVED_ROW, slug: "alice-smith-1" };

    let slugCallCount = 0;
    const eq = vi.fn().mockImplementation(() => {
      slugCallCount++;
      return Promise.resolve({ data: slugCallCount === 1 ? [clashRow] : [], error: null });
    });
    const slugChain = { select: vi.fn().mockReturnValue({ eq }) };

    const dmlFinal = { single: vi.fn().mockResolvedValue({ data: savedWithSuffix, error: null }) };
    const dmlSelect = vi.fn().mockReturnValue(dmlFinal);
    const dmlChain = { insert: vi.fn().mockReturnValue({ select: dmlSelect, single: dmlFinal.single }) };

    let fromCount = 0;
    (createSupabaseServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockImplementation(() => {
        fromCount++;
        return fromCount <= 2 ? slugChain : dmlChain;
      }),
    });

    const result = await saveAuthor({ name: "Alice Smith" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(dmlChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "alice-smith-1" })
    );
  });
});

describe("saveAuthor — EC3 markup/script in name", () => {
  it("stores name containing script tags as plain text", async () => {
    (requireStaff as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, user: STAFF });
    const scriptRow = { ...SAVED_ROW, name: "<script>alert(1)</script>", slug: "script-alert1-script" };
    setupMock({ savedRow: scriptRow });

    const result = await saveAuthor({ name: "<script>alert(1)</script>" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(typeof result.author.name).toBe("string");
  });
});

describe("saveAuthor — EC4 blank name", () => {
  it("returns validation_failed for all-space name", async () => {
    (requireStaff as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, user: STAFF });

    const result = await saveAuthor({ name: "   " });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("validation_failed");
    expect(result.field).toBe("name");
  });

  it("returns validation_failed for empty name", async () => {
    (requireStaff as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, user: STAFF });

    const result = await saveAuthor({ name: "" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("validation_failed");
  });
});

describe("saveAuthor — AC4/EC5 version conflict", () => {
  it("returns version_conflict when updated_at is stale", async () => {
    (requireStaff as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, user: STAFF });
    setupMock({ existingRow: { id: AUTHOR_ID, updated_at: "2026-02-01T00:00:00Z" } });

    const result = await saveAuthor({ id: AUTHOR_ID, name: "Alice Smith", updatedAt: UPDATED_AT });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("version_conflict");
  });

  it("returns version_conflict when id present but updatedAt absent", async () => {
    (requireStaff as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, user: STAFF });
    setupMock({ existingRow: { id: AUTHOR_ID, updated_at: "2026-02-01T00:00:00Z" } });

    const result = await saveAuthor({ id: AUTHOR_ID, name: "Alice Smith" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("version_conflict");
  });

  it("returns not_found when updating an unknown author ID", async () => {
    (requireStaff as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, user: STAFF });
    setupMock({ existingRow: null });

    const result = await saveAuthor({ id: "00000000-0000-4000-8000-000000000099", name: "Ghost", updatedAt: UPDATED_AT });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("not_found");
  });
});

describe("saveAuthor — slug check DB error", () => {
  it("returns unknown when the slug-clash query fails", async () => {
    (requireStaff as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, user: STAFF });

    // eq() resolves with a DB error — clashSafeAuthorSlug throws, saveAuthor returns unknown
    const eq = vi.fn().mockResolvedValue({ data: null, error: { message: "db error" } });
    const slugChain = { select: vi.fn().mockReturnValue({ eq }) };

    (createSupabaseServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue(slugChain),
    });

    const result = await saveAuthor({ name: "Alice Smith" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("unknown");
  });
});
