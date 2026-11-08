// S-051: moderateComment — AC2, AC3, AC5, AC6, EC1, EC2, EC3

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

function makePendingComment(overrides: Record<string, unknown> = {}) {
  return {
    id: COMMENT_ID,
    status: "pending",
    article_id: ARTICLE_ID,
    profiles: { suspended_at: null },
    ...overrides,
  };
}

function makeChain(opts: {
  commentData?: Record<string, unknown> | null;
  commentError?: { message: string } | null;
  updateError?: { message: string } | null;
} = {}) {
  const updateChain = {
    eq: vi.fn().mockResolvedValue({ error: opts.updateError ?? null }),
  };
  const selectChain = {
    eq: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: opts.commentData !== undefined ? opts.commentData : makePendingComment(),
        error: opts.commentError ?? null,
      }),
    }),
  };
  const sb = {
    from: vi.fn().mockImplementation(() => ({
      select: vi.fn().mockReturnValue(selectChain),
      update: vi.fn().mockReturnValue(updateChain),
    })),
  };
  (createSupabaseServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(sb);
  return sb;
}

beforeEach(() => {
  vi.clearAllMocks();
  (requireStaff as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, user: STAFF_USER });
  (checkAdminWriteLimit as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
  (checkAdminDestructiveLimit as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
  (writeAuditRow as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  (purgeArticle as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
});

describe("moderateComment", () => {
  it("AC2/AC3: approve a pending comment and writes audit row", async () => {
    makeChain();
    const result = await moderateComment(COMMENT_ID, "approve", STAFF_USER.id);
    expect(result.ok).toBe(true);
    expect(writeAuditRow).toHaveBeenCalledWith(
      expect.objectContaining({ action: "comment.approve" })
    );
  });

  it("AC2/AC3: reject a pending comment and writes audit row", async () => {
    makeChain();
    const result = await moderateComment(COMMENT_ID, "reject", STAFF_USER.id);
    expect(result.ok).toBe(true);
    expect(writeAuditRow).toHaveBeenCalledWith(
      expect.objectContaining({ action: "comment.reject" })
    );
  });

  it("AC2/AC3: reject an approved comment (unpublish)", async () => {
    makeChain({ commentData: makePendingComment({ status: "approved" }) });
    const result = await moderateComment(COMMENT_ID, "reject", STAFF_USER.id);
    expect(result.ok).toBe(true);
  });

  it("AC2/AC3: delete an approved (published) comment and writes audit row", async () => {
    makeChain({ commentData: makePendingComment({ status: "approved" }) });
    const result = await moderateComment(COMMENT_ID, "delete", STAFF_USER.id);
    expect(result.ok).toBe(true);
    expect(writeAuditRow).toHaveBeenCalledWith(
      expect.objectContaining({ action: "comment.delete" })
    );
  });

  it("AC2/AC3: restore a rejected comment and writes audit row", async () => {
    makeChain({ commentData: makePendingComment({ status: "rejected" }) });
    const result = await moderateComment(COMMENT_ID, "restore", STAFF_USER.id);
    expect(result.ok).toBe(true);
    expect(writeAuditRow).toHaveBeenCalledWith(
      expect.objectContaining({ action: "comment.restore" })
    );
  });

  it("AC5: triggers purge after approval", async () => {
    makeChain();
    await moderateComment(COMMENT_ID, "approve", STAFF_USER.id);
    expect(purgeArticle).toHaveBeenCalledWith(ARTICLE_ID, expect.any(String), STAFF_USER.id);
  });

  it("AC5: returns purge_failed if purge fails but decision is saved", async () => {
    makeChain();
    (purgeArticle as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, code: "purge_failed" });
    const result = await moderateComment(COMMENT_ID, "approve", STAFF_USER.id);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("purge_failed");
  });

  it("AC6/EC2: repeating the same decision returns already_done", async () => {
    makeChain({ commentData: makePendingComment({ status: "approved" }) });
    const result = await moderateComment(COMMENT_ID, "approve", STAFF_USER.id);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("validation_failed");
      expect(result.reason).toBe("already_done");
    }
  });

  it("EC1: allows moderation of a comment from a suspended writer", async () => {
    makeChain({ commentData: makePendingComment({ profiles: { suspended_at: "2026-10-01T00:00:00Z" } }) });
    const result = await moderateComment(COMMENT_ID, "approve", STAFF_USER.id);
    expect(result.ok).toBe(true);
  });

  it("EC3: allows moderation when article is hidden", async () => {
    makeChain({ commentData: makePendingComment({ status: "pending" }) });
    const result = await moderateComment(COMMENT_ID, "approve", STAFF_USER.id);
    expect(result.ok).toBe(true);
  });

  it("EC7: restore on a pending comment returns wrong_state", async () => {
    makeChain();
    const result = await moderateComment(COMMENT_ID, "restore", STAFF_USER.id);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("validation_failed");
      expect(result.reason).toBe("wrong_state");
    }
  });

  it("EC7: delete on a pending comment returns wrong_state", async () => {
    makeChain();
    const result = await moderateComment(COMMENT_ID, "delete", STAFF_USER.id);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("validation_failed");
      expect(result.reason).toBe("wrong_state");
    }
  });

  it("returns validation_failed for invalid commentId", async () => {
    makeChain();
    const result = await moderateComment("not-a-uuid", "approve", STAFF_USER.id);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("validation_failed");
  });

  it("returns not_found when comment does not exist", async () => {
    makeChain({ commentData: null, commentError: { message: "PGRST116" } });
    const result = await moderateComment(COMMENT_ID, "approve", STAFF_USER.id);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_found");
  });

  it("AC9: returns rate_limited when destructive limit exceeded", async () => {
    makeChain({ commentData: makePendingComment({ status: "approved" }) });
    (checkAdminDestructiveLimit as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, reason: "rate_limited" });
    const result = await moderateComment(COMMENT_ID, "delete", STAFF_USER.id);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("rate_limited");
  });
});
