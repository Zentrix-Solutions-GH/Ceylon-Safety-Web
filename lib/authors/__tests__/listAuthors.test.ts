// S-052: AC1 — listAuthors

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
vi.mock("next/cache", () => ({
  unstable_noStore: vi.fn(),
}));

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/server";
import { writeAuditRow } from "@/lib/audit/index";
import { listAuthors } from "@/lib/authors/actions/listAuthors";

const STAFF = { id: "00000000-0000-4000-8000-000000000001", claimedRole: "admin" as const };

const DB_AUTHORS = [
  { id: "00000000-0000-4000-8000-000000000010", name: "Alice", slug: "alice", bio: null, is_active: true, updated_at: "2026-01-01T00:00:00Z" },
  { id: "00000000-0000-4000-8000-000000000011", name: "Bob", slug: "bob", bio: "Writer", is_active: false, updated_at: "2026-01-02T00:00:00Z" },
];

function makeChain(rows: typeof DB_AUTHORS) {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn().mockReturnThis();
  chain.select = vi.fn().mockReturnThis();
  chain.eq = vi.fn().mockReturnThis();
  chain.order = vi.fn().mockResolvedValue({ data: rows, error: null });
  (createSupabaseServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(chain);
}

beforeEach(() => {
  vi.clearAllMocks();
  (writeAuditRow as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
});

describe("listAuthors — AC1", () => {
  it("returns active authors when includeInactive=false (editor picker)", async () => {
    (requireStaff as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, user: STAFF });
    makeChain([DB_AUTHORS[0]]);

    const result = await listAuthors({ includeInactive: false });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.authors).toHaveLength(1);
    expect(result.authors[0].name).toBe("Alice");
    expect(result.authors[0].isActive).toBe(true);
  });

  it("returns all authors when includeInactive=true (admin screen)", async () => {
    (requireStaff as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, user: STAFF });
    makeChain(DB_AUTHORS);

    const result = await listAuthors({ includeInactive: true });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.authors).toHaveLength(2);
  });

  it("returns not_allowed for caller without authors.*", async () => {
    (requireStaff as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false });

    const result = await listAuthors({});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("not_allowed");
  });

  it("maps DB snake_case to camelCase Author shape", async () => {
    (requireStaff as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, user: STAFF });
    makeChain([DB_AUTHORS[0]]);

    const result = await listAuthors({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const a = result.authors[0];
    expect(a).toMatchObject({
      id: DB_AUTHORS[0].id,
      name: "Alice",
      slug: "alice",
      bio: null,
      isActive: true,
      updatedAt: "2026-01-01T00:00:00Z",
    });
  });
});
