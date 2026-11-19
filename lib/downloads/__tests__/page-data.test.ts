// S-085: getDownloadPageData — AC8

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({ serverConfig: { supabaseServiceRoleKey: "srk" } }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDownloadPageData } from "@/lib/downloads/claim";

const ORDER_ITEM_ID = "00000000-0000-4000-8001-000000000001";
const ENT_ID        = "00000000-0000-4000-8000-000000000001";
const USER_ID       = "user-buyer-1";

function makeDb(entRow: Record<string, unknown> | null, orderItemRow: Record<string, unknown> | null = null) {
  return {
    from: vi.fn((table: string) => {
      if (table === "entitlements") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: entRow,
            error: entRow ? null : { code: "PGRST116" },
          }),
        };
      }
      if (table === "order_items") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: orderItemRow,
            error: orderItemRow ? null : { code: "PGRST116" },
          }),
        };
      }
      return {};
    }),
  };
}

const ENT_ROW = {
  id: ENT_ID,
  user_id: USER_ID,
  document_id: "doc-1",
  order_item_id: ORDER_ITEM_ID,
  language: "en",
  download_limit: 1,
  downloads_used: 0,
  revoked_at: null,
};

const ORDER_ITEM_ROW = {
  id: ORDER_ITEM_ID,
  title_snapshot: "Safety Plan 2026",
  language: "en",
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── AC8: owner gets data ─────────────────────────────────────────────────────

describe("getDownloadPageData — owner", () => {
  it("returns title snapshot, language, and downloads left for the owner (AC8)", async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue(
      makeDb(ENT_ROW, ORDER_ITEM_ROW) as never
    );
    const result = await getDownloadPageData({ orderItemId: ORDER_ITEM_ID, userId: USER_ID });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data?.titleSnapshot).toBe("Safety Plan 2026");
    expect(result.data?.language).toBe("en");
    expect(result.data?.downloadsLeft).toBe(1);
    expect(result.data?.entitlementId).toBe(ENT_ID);
  });

  it("returns downloadsLeft = 0 when already used (AC8)", async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue(
      makeDb({ ...ENT_ROW, downloads_used: 1 }, ORDER_ITEM_ROW) as never
    );
    const result = await getDownloadPageData({ orderItemId: ORDER_ITEM_ID, userId: USER_ID });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data?.downloadsLeft).toBe(0);
  });
});

// ─── AC8: non-owner → not_found ──────────────────────────────────────────────

describe("getDownloadPageData — non-owner", () => {
  it("returns not_found for a different user without revealing entitlement exists (AC8)", async () => {
    // The user-scoped query returns no row (RLS hides it)
    vi.mocked(createSupabaseServerClient).mockResolvedValue(
      makeDb(null) as never
    );
    const result = await getDownloadPageData({ orderItemId: ORDER_ITEM_ID, userId: "other-user" });
    expect(result).toMatchObject({ ok: false, code: "not_found" });
  });

  it("returns not_found for unknown orderItemId (AC8)", async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue(
      makeDb(null) as never
    );
    const result = await getDownloadPageData({ orderItemId: "00000000-0000-4000-8099-000000000099", userId: USER_ID });
    expect(result).toMatchObject({ ok: false, code: "not_found" });
  });
});
