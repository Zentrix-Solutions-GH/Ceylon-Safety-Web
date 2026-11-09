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

// DML chain supports .insert().select().single() and .update().eq().eq().select().single()
// eq is self-chainable so any number of .eq() calls works.
function makeDmlChain(savedRow: Record<string, unknown>) {
  const single = vi.fn().mockResolvedValue({ data: savedRow, error: null });
  const select = vi.fn().mockReturnValue({ single });
  const eq: ReturnType<typeof vi.fn> = vi.fn();
  eq.mockReturnValue({ select, single, eq });
  return { insert: vi.fn().mockReturnValue({ select, single }), update: vi.fn().mockReturnValue({ eq }), select, single, eq };
}

function makeSlugChain(rows: { id: string }[]) {
  const eq = vi.fn().mockResolvedValue({ data: rows, error: null });
  const select = vi.fn().mockReturnValue({ eq });
  return { select };
}

// Action call order for create: (1) slug check → (2) insert
// Action call order for update (success): (1) slug check → (2) update DML
// Action call order for update (PGRST116): (1) slug check → (2) update DML → (3) existence check
function setupMock({
  slugRows = [] as { id: string }[],
  savedRow = SAVED_ROW as Record<string, unknown>,
} = {}) {
  let callCount = 0;
  const dmlChain = makeDmlChain(savedRow);
  const slugChain = makeSlugChain(slugRows);

  const supabase = {
    from: vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return slugChain; // slug check
      return dmlChain;                       // insert or update DML
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
  // For update paths the action now first fetches the current row to check whether the
  // name changed (to avoid slug regeneration). Call order:
  //   from() #1 → currentRowChain (.select().eq().maybeSingle())
  //   from() #2 → dmlChain (update)
  //   from() #3 → existsChain (PGRST116 existence check, when needed)

  function makeCurrentRowChain(currentName: string, currentSlug: string) {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { name: currentName, slug: currentSlug }, error: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    return { select: vi.fn().mockReturnValue({ eq }) };
  }

  it("returns version_conflict when updated_at is stale", async () => {
    (requireStaff as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, user: STAFF });

    // Name unchanged → slug kept → no slug check step.
    // Update DML: PGRST116 (updated_at mismatch). Existence: author found.
    const currentRowChain = makeCurrentRowChain("Alice Smith", "alice-smith");

    const updateSingle = vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } });
    const updateSelect = vi.fn().mockReturnValue({ single: updateSingle });
    const updateEq2 = vi.fn().mockReturnValue({ select: updateSelect, single: updateSingle });
    const updateEq1 = vi.fn().mockReturnValue({ eq: updateEq2 });
    const dmlChain = { update: vi.fn().mockReturnValue({ eq: updateEq1 }) };

    const existsMaybeSingle = vi.fn().mockResolvedValue({ data: { id: AUTHOR_ID }, error: null });
    const existsEq = vi.fn().mockReturnValue({ maybeSingle: existsMaybeSingle });
    const existsChain = { select: vi.fn().mockReturnValue({ eq: existsEq }) };

    let fromCount = 0;
    (createSupabaseServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockImplementation(() => {
        fromCount++;
        if (fromCount === 1) return currentRowChain;
        if (fromCount === 2) return dmlChain;
        return existsChain;
      }),
    });

    const result = await saveAuthor({ id: AUTHOR_ID, name: "Alice Smith", updatedAt: UPDATED_AT });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("version_conflict");
  });

  it("returns version_conflict when id present but updatedAt absent", async () => {
    (requireStaff as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, user: STAFF });
    // Early return before any DB call — no supabase mock needed

    const result = await saveAuthor({ id: AUTHOR_ID, name: "Alice Smith" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("version_conflict");
  });

  it("returns not_found when updating an unknown author ID", async () => {
    (requireStaff as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, user: STAFF });

    // Current row fetch returns null (author not found at fetch time).
    // Name is treated as changed → slug check → update DML → PGRST116 → existence: null.
    const currentRowChain = (() => {
      const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      const eq = vi.fn().mockReturnValue({ maybeSingle });
      return { select: vi.fn().mockReturnValue({ eq }) };
    })();

    const slugEq = vi.fn().mockResolvedValue({ data: [], error: null });
    const slugChain = { select: vi.fn().mockReturnValue({ eq: slugEq }) };

    const updateSingle = vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } });
    const updateSelect = vi.fn().mockReturnValue({ single: updateSingle });
    const updateEq2 = vi.fn().mockReturnValue({ select: updateSelect, single: updateSingle });
    const updateEq1 = vi.fn().mockReturnValue({ eq: updateEq2 });
    const dmlChain = { update: vi.fn().mockReturnValue({ eq: updateEq1 }) };

    const existsMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const existsEq = vi.fn().mockReturnValue({ maybeSingle: existsMaybeSingle });
    const existsChain = { select: vi.fn().mockReturnValue({ eq: existsEq }) };

    let fromCount = 0;
    (createSupabaseServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockImplementation(() => {
        fromCount++;
        if (fromCount === 1) return currentRowChain; // fetch current row
        if (fromCount === 2) return slugChain;        // slug check (name changed)
        if (fromCount === 3) return dmlChain;         // update DML
        return existsChain;                           // existence check
      }),
    });

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

  it("returns unknown when slug generation exceeds 100 attempts (slug_max_attempts)", async () => {
    (requireStaff as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, user: STAFF });

    // Always return a clash row — forces the loop past 100 iterations and throws slug_max_attempts.
    const eq = vi.fn().mockResolvedValue({ data: [{ id: "other-author-id" }], error: null });
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
