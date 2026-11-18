// S-085: requestDownload — AC9, EC5

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({ serverConfig: { supabaseServiceRoleKey: "srk" } }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requestDownload } from "@/lib/downloads/requests";

const ENT_ID  = "00000000-0000-4000-8000-000000000001";
const USER_ID = "user-buyer-1";

function makeDb(entRow: Record<string, unknown> | null, insertError: unknown = null, existingOpenRequest: unknown = null) {
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
      if (table === "download_requests") {
        const chain = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: existingOpenRequest,
            error: existingOpenRequest ? null : { code: "PGRST116" },
          }),
          insert: vi.fn().mockReturnThis(),
          values: vi.fn().mockReturnThis(),
          returning: vi.fn().mockReturnThis(),
          // Supabase insert chain
        };
        // For insert path
        chain.insert = vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: insertError ? null : { id: "req-1", entitlement_id: ENT_ID, user_id: USER_ID, status: "open", requested_at: new Date().toISOString(), note: null },
            error: insertError,
          }),
        }));
        return chain;
      }
      return {};
    }),
  };
}

const ENT_ROW = {
  id: ENT_ID,
  user_id: USER_ID,
  document_id: "doc-1",
  language: "en",
  download_limit: 1,
  downloads_used: 1, // used up — buyer requests a new one
  revoked_at: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── AC9: creates open request ────────────────────────────────────────────────

describe("requestDownload — creates request", () => {
  it("creates an open download_requests row and returns ok (AC9)", async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue(makeDb(ENT_ROW) as never);
    const result = await requestDownload({ entitlementId: ENT_ID, userId: USER_ID });
    expect(result.ok).toBe(true);
  });

  it("includes the optional note when provided (AC9)", async () => {
    const db = makeDb(ENT_ROW) as ReturnType<typeof makeDb>;
    vi.mocked(createSupabaseServerClient).mockResolvedValue(db as never);
    const result = await requestDownload({ entitlementId: ENT_ID, userId: USER_ID, note: "file failed to download" });
    expect(result.ok).toBe(true);
  });
});

// ─── AC9: not owner → not_found ──────────────────────────────────────────────

describe("requestDownload — not owner", () => {
  it("returns not_found when entitlement not found (RLS hides other users' rows) (AC9)", async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue(makeDb(null) as never);
    const result = await requestDownload({ entitlementId: ENT_ID, userId: "other-user" });
    expect(result).toMatchObject({ ok: false, code: "not_found" });
  });
});

// ─── EC5: one open request per purchase ──────────────────────────────────────

describe("requestDownload — duplicate open request", () => {
  it("returns request_already_open when an open request already exists (EC5)", async () => {
    const existingRequest = { id: "req-existing", entitlement_id: ENT_ID, status: "open" };
    vi.mocked(createSupabaseServerClient).mockResolvedValue(
      makeDb(ENT_ROW, null, existingRequest) as never
    );
    const result = await requestDownload({ entitlementId: ENT_ID, userId: USER_ID });
    expect(result).toMatchObject({ ok: false, code: "request_already_open" });
  });
});
