// S-051: bulkRejectComments — AC4, EC4

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
import { checkAdminWriteLimit } from "@/lib/ratelimit";
import { writeAuditRow } from "@/lib/audit/index";
import { purgeArticle } from "@/lib/cache/purge";
import { bulkRejectComments } from "@/lib/engagement/actions/bulkRejectComments";

const STAFF_USER = { id: "7765b438-c85d-4489-8687-62317a39110f", claimedRole: "admin" as const };
const CMT_1 = "52e62569-331f-4656-bde7-adcacabe5696";
const CMT_2 = "07be518e-a9f9-42c5-85c6-754a2e6f415b";
const CMT_APPROVED = "c041b707-38ed-4695-bf71-52f9e0efc43b";
const CMT_REJECTED = "0710bdf0-2da9-4544-96c4-309b9827cafb";
const ARTICLE_ID = "b7a8fb35-b9c5-4f1a-bb6a-cad9648fe00a";

function makePendingRows(ids: string[]) {
  return ids.map((id) => ({ id, status: "pending", article_id: ARTICLE_ID }));
}

function makeChain(opts: {
  selectRows?: unknown[];
  updateError?: { message: string } | null;
} = {}) {
  const rows = opts.selectRows ?? makePendingRows([CMT_1, CMT_2]);
  const sb = {
    from: vi.fn().mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ data: rows, error: null }),
      }),
      update: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ error: opts.updateError ?? null }),
      }),
    })),
  };
  (createSupabaseServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(sb);
  return sb;
}

beforeEach(() => {
  vi.clearAllMocks();
  (requireStaff as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, user: STAFF_USER });
  (checkAdminWriteLimit as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
  (writeAuditRow as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  (purgeArticle as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
});

describe("bulkRejectComments", () => {
  it("AC4: rejects pending comments and returns rejected ids", async () => {
    makeChain();
    const result = await bulkRejectComments([CMT_1, CMT_2]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rejected).toHaveLength(2);
      expect(result.skipped).toHaveLength(0);
    }
  });

  it("AC4: writes one audit row per rejected comment", async () => {
    makeChain();
    await bulkRejectComments([CMT_1, CMT_2]);
    expect(writeAuditRow).toHaveBeenCalledTimes(2);
  });

  it("AC4/EC4: skips already-decided ids and reports them", async () => {
    makeChain({ selectRows: [{ id: CMT_1, status: "pending", article_id: ARTICLE_ID }] });
    const result = await bulkRejectComments([CMT_1, CMT_APPROVED]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rejected).toContain(CMT_1);
      expect(result.skipped).toContain(CMT_APPROVED);
    }
  });

  it("AC4/EC4: returns all skipped when all ids are non-pending", async () => {
    makeChain({ selectRows: [] });
    const result = await bulkRejectComments([CMT_APPROVED, CMT_REJECTED]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rejected).toHaveLength(0);
      expect(result.skipped).toHaveLength(2);
    }
  });

  it("EC4: more than 100 ids returns validation_failed", async () => {
    makeChain();
    // Generate 101 valid v4-ish UUIDs using a seeded pattern
    const ids = Array.from({ length: 101 }, (_, i) =>
      `${i.toString(16).padStart(8, "0")}-1234-4abc-8def-${i.toString(16).padStart(12, "0")}`
    );
    const result = await bulkRejectComments(ids);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("validation_failed");
  });

  it("EC4: empty ids array returns validation_failed", async () => {
    makeChain();
    const result = await bulkRejectComments([]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("validation_failed");
  });

  it("AC9: returns rate_limited when write limit exceeded", async () => {
    makeChain();
    (checkAdminWriteLimit as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, reason: "rate_limited" });
    const result = await bulkRejectComments([CMT_1]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("rate_limited");
  });

  it("AC5: returns purge_failed when purge fails for a rejected comment", async () => {
    makeChain();
    (purgeArticle as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, code: "purge_failed" });
    const result = await bulkRejectComments([CMT_1, CMT_2]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("purge_failed");
  });
});
