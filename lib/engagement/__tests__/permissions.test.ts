// S-051: permission matrix — AC8

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
vi.mock("@/lib/ratelimit", () => ({
  checkAdminWriteLimit: vi.fn(),
  checkAdminDestructiveLimit: vi.fn(),
}));
vi.mock("@/lib/audit/index", () => ({
  writeAuditRow: vi.fn(),
}));
vi.mock("@/lib/cache/purge", () => ({
  purgeArticle: vi.fn(),
}));
vi.mock("next/cache", () => ({
  unstable_noStore: vi.fn(),
}));

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/server";
import { checkAdminWriteLimit, checkAdminDestructiveLimit } from "@/lib/ratelimit";
import { writeAuditRow } from "@/lib/audit/index";
import { purgeArticle } from "@/lib/cache/purge";
import { listCommentsForModeration } from "@/lib/engagement/actions/listCommentsForModeration";
import { moderateComment } from "@/lib/engagement/actions/moderateComment";

const STAFF_USER = { id: "7765b438-c85d-4489-8687-62317a39110f", claimedRole: "admin" as const };
const COMMENT_ID = "fb6706be-63c7-438f-a12c-c3ed2e38f16e";

function makeChain() {
  const updateChain: Record<string, unknown> = {};
  updateChain.eq = vi.fn().mockReturnValue(updateChain);
  updateChain.select = vi.fn().mockResolvedValue({ data: [{ id: COMMENT_ID }], error: null });

  const chain: Record<string, unknown> = {};
  const methods = ["from", "select", "eq", "is", "order", "range", "single"];
  for (const m of methods) chain[m] = vi.fn().mockReturnThis();
  chain.range = vi.fn().mockResolvedValue({ data: [], error: null });
  chain.single = vi.fn().mockResolvedValue({
    data: { id: COMMENT_ID, status: "pending", article_id: "b7a8fb35-b9c5-4f1a-bb6a-cad9648fe00a", profiles: { suspended_at: null } },
    error: null,
  });
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(updateChain);
  (createSupabaseServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(chain);
}

beforeEach(() => {
  vi.clearAllMocks();
  (checkAdminWriteLimit as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
  (checkAdminDestructiveLimit as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
  (writeAuditRow as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  (purgeArticle as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
  makeChain();
});

describe("permissions — AC8", () => {
  it("Super Admin passes listCommentsForModeration", async () => {
    (requireStaff as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, user: STAFF_USER });
    const result = await listCommentsForModeration({ state: "pending" });
    expect(result.ok).toBe(true);
  });

  it("Admin with comments.moderate passes moderateComment", async () => {
    (requireStaff as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, user: STAFF_USER });
    const result = await moderateComment(COMMENT_ID, "approve");
    expect(result.ok).toBe(true);
  });

  it("Editor with comments.moderate passes (Q62/Q63 role answer)", async () => {
    const editorId = "1d7c056f-9d90-4330-96af-57487502ff8c";
    (requireStaff as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      user: { id: editorId, claimedRole: "editor" as const },
    });
    const result = await moderateComment(COMMENT_ID, "approve");
    expect(result.ok).toBe(true);
  });

  it("Customer is refused (not_allowed) and audit row written", async () => {
    (requireStaff as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      code: "not_allowed",
    });
    const result = await listCommentsForModeration({ state: "pending" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_allowed");
    expect(writeAuditRow).toHaveBeenCalledWith(
      expect.objectContaining({ action: "permission.denied" })
    );
  });

  it("Editor without comments.moderate is refused (not_allowed) and audit row written", async () => {
    (requireStaff as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      code: "not_allowed",
    });
    const result = await moderateComment(COMMENT_ID, "approve");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_allowed");
    expect(writeAuditRow).toHaveBeenCalledWith(
      expect.objectContaining({ action: "permission.denied" })
    );
  });
});
