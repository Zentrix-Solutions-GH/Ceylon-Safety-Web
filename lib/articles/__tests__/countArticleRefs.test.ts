// S-048: countArticleRefs — AC11

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

import { requireStaff } from "@/lib/auth/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { countArticleRefs } from "@/lib/articles/countArticleRefs";

const DOC_ID = "ff000002-0000-4000-8000-000000000001";
const STAFF_USER = { id: "aa000003-0000-4000-8000-000000000001", claimedRole: "admin" as const };

function mockStaff(ok: boolean) {
  if (ok) {
    vi.mocked(requireStaff).mockResolvedValue({ ok: true, user: STAFF_USER as never });
  } else {
    vi.mocked(requireStaff).mockResolvedValue({ ok: false, code: "not_allowed" });
  }
}

function makeSupabaseMock(count: number) {
  return {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: vi.fn().mockResolvedValue({ count, error: null }),
    })),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("countArticleRefs", () => {
  it("EC1: not_allowed when staff check fails", async () => {
    mockStaff(false);
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(makeSupabaseMock(0) as never);
    const result = await countArticleRefs("document", DOC_ID);
    expect(result.ok).toBe(false);
    expect((result as { ok: false; code: string }).code).toBe("not_allowed");
  });

  it("returns count of live articles using the item", async () => {
    mockStaff(true);
    const mockSb = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockResolvedValue({ count: 3, error: null }),
      })),
    };
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(mockSb as never);
    const result = await countArticleRefs("document", DOC_ID);
    expect(result.ok).toBe(true);
    expect((result as { ok: true; count: number }).count).toBe(3);
  });

  it("returns 0 when no articles reference the item", async () => {
    mockStaff(true);
    const mockSb = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockResolvedValue({ count: 0, error: null }),
      })),
    };
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(mockSb as never);
    const result = await countArticleRefs("video", DOC_ID);
    expect(result.ok).toBe(true);
    expect((result as { ok: true; count: number }).count).toBe(0);
  });
});
