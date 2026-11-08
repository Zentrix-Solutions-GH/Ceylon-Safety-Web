// S-051: listCommentsForModeration — AC1

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
vi.mock("next/cache", () => ({
  unstable_noStore: vi.fn(),
}));
vi.mock("@/lib/audit/index", () => ({
  writeAuditRow: vi.fn(),
}));

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/server";
import { writeAuditRow } from "@/lib/audit/index";
import { listCommentsForModeration } from "@/lib/engagement/actions/listCommentsForModeration";

const STAFF_USER = { id: "staff-1", claimedRole: "admin" as const };

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "cmt-1",
    body: "Great article",
    status: "pending",
    created_at: "2026-10-01T10:00:00Z",
    profiles: { display_name: "Alice", deleted_at: null },
    writer_suspended: false,
    articles: { title: "Fire Safety", slug: "fire-safety" },
    moderator: null,
    moderated_at: null,
    ...overrides,
  };
}

function makeChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  const methods = ["from", "select", "eq", "order", "lt", "or", "gt", "range", "lte", "gte", "is", "neq"];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnThis();
  }
  chain.range = vi.fn().mockResolvedValue({ data: rows, error: null });
  (createSupabaseServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
  (requireStaff as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, user: STAFF_USER });
  (writeAuditRow as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
});

describe("listCommentsForModeration", () => {
  it("AC1: requires comments.moderate permission and writes audit row", async () => {
    (requireStaff as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, code: "not_allowed" });
    makeChain([]);
    const result = await listCommentsForModeration({ state: "pending" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_allowed");
    expect(writeAuditRow).toHaveBeenCalledWith(
      expect.objectContaining({ action: "permission.denied" })
    );
  });

  it("AC1: returns validation_failed for invalid state", async () => {
    makeChain([]);
    const result = await listCommentsForModeration({ state: "bogus" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("validation_failed");
  });

  it("AC1: returns pending comments oldest first by default", async () => {
    const rows = [makeRow(), makeRow({ id: "cmt-2", created_at: "2026-10-02T10:00:00Z" })];
    makeChain(rows);
    const result = await listCommentsForModeration({ state: "pending" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.comments).toHaveLength(2);
      expect(result.comments[0].id).toBe("cmt-1");
    }
  });

  it("AC1: maps writerSuspended flag", async () => {
    makeChain([makeRow({ writer_suspended: true })]);
    const result = await listCommentsForModeration({ state: "pending" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.comments[0].writerSuspended).toBe(true);
  });

  it("AC1: includes moderator name and time for decided comments", async () => {
    const row = makeRow({
      status: "approved",
      moderator: { display_name: "Bob" },
      moderated_at: "2026-10-01T12:00:00Z",
    });
    makeChain([row]);
    const result = await listCommentsForModeration({ state: "approved" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.comments[0].moderatorName).toBe("Bob");
      expect(result.comments[0].moderatedAt).toBe("2026-10-01T12:00:00Z");
    }
  });

  it("AC1: moderatorName is null when moderator profile was anonymised (EC8)", async () => {
    const row = makeRow({
      status: "rejected",
      moderator: null,
      moderated_at: "2026-10-01T12:00:00Z",
    });
    makeChain([row]);
    const result = await listCommentsForModeration({ state: "rejected" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.comments[0].moderatorName).toBeNull();
  });

  it("AC1: returns nextCursor when page is full (25 rows)", async () => {
    const rows = Array.from({ length: 25 }, (_, i) =>
      makeRow({ id: `cmt-${i}`, created_at: `2026-10-${String(i + 1).padStart(2, "0")}T10:00:00Z` })
    );
    makeChain(rows);
    const result = await listCommentsForModeration({ state: "pending" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.nextCursor).not.toBeNull();
  });

  it("AC1: returns null cursor when fewer than 25 rows", async () => {
    makeChain([makeRow()]);
    const result = await listCommentsForModeration({ state: "pending" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.nextCursor).toBeNull();
  });

  it("EC5: anonymised writer (profiles null) shows 'Deleted user'", async () => {
    makeChain([makeRow({ profiles: null })]);
    const result = await listCommentsForModeration({ state: "pending" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.comments[0].writerDisplayName).toBe("Deleted user");
  });
});
