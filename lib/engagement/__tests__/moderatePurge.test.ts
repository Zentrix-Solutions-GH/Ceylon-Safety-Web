// S-051: purge integration for moderation actions — AC5

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

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/server";
import { checkAdminWriteLimit, checkAdminDestructiveLimit } from "@/lib/ratelimit";
import { writeAuditRow } from "@/lib/audit/index";
import { purgeArticle } from "@/lib/cache/purge";
import { moderateComment } from "@/lib/engagement/actions/moderateComment";

const STAFF_USER = { id: "7765b438-c85d-4489-8687-62317a39110f", claimedRole: "admin" as const };
const COMMENT_ID = "fb6706be-63c7-438f-a12c-c3ed2e38f16e";
const ARTICLE_ID = "b7a8fb35-b9c5-4f1a-bb6a-cad9648fe00a";

function makeChain(commentData: Record<string, unknown>) {
  const updateChain = { eq: vi.fn().mockResolvedValue({ error: null }) };
  const sb = {
    from: vi.fn().mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: commentData, error: null }),
        }),
      }),
      update: vi.fn().mockReturnValue(updateChain),
    })),
  };
  (createSupabaseServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(sb);
}

beforeEach(() => {
  vi.clearAllMocks();
  (requireStaff as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, user: STAFF_USER });
  (checkAdminWriteLimit as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
  (checkAdminDestructiveLimit as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
  (writeAuditRow as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  (purgeArticle as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
});

describe("moderateComment — purge (AC5)", () => {
  it("calls purgeArticle with correct articleId after approve", async () => {
    makeChain({ id: COMMENT_ID, status: "pending", article_id: ARTICLE_ID, profiles: { suspended_at: null } });
    await moderateComment(COMMENT_ID, "approve", STAFF_USER.id);
    expect(purgeArticle).toHaveBeenCalledWith(ARTICLE_ID, expect.any(String), STAFF_USER.id);
  });

  it("calls purgeArticle after reject", async () => {
    makeChain({ id: COMMENT_ID, status: "pending", article_id: ARTICLE_ID, profiles: { suspended_at: null } });
    await moderateComment(COMMENT_ID, "reject", STAFF_USER.id);
    expect(purgeArticle).toHaveBeenCalledWith(ARTICLE_ID, expect.any(String), STAFF_USER.id);
  });

  it("calls purgeArticle after delete", async () => {
    makeChain({ id: COMMENT_ID, status: "approved", article_id: ARTICLE_ID, profiles: { suspended_at: null } });
    await moderateComment(COMMENT_ID, "delete", STAFF_USER.id);
    expect(purgeArticle).toHaveBeenCalledWith(ARTICLE_ID, expect.any(String), STAFF_USER.id);
  });

  it("decision is saved and purge_failed is returned when purge fails", async () => {
    makeChain({ id: COMMENT_ID, status: "pending", article_id: ARTICLE_ID, profiles: { suspended_at: null } });
    (purgeArticle as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, code: "purge_failed" });
    const result = await moderateComment(COMMENT_ID, "approve", STAFF_USER.id);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("purge_failed");
  });
});
