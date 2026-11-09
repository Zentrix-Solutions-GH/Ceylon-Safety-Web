// AC4: price is required on create; saveDocument never changes price on edit.
// Unit tests — mocks the DB client so no Supabase needed.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({
  serverConfig: { supabaseServiceRoleKey: "srk" },
  publicConfig: { supabaseUrl: "https://test.supabase.co", supabaseAnonKey: "anon" },
}));

const mockFrom = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
  createSupabaseServiceRoleClient: vi.fn(() => ({ from: mockFrom })),
}));

vi.mock("@/lib/auth/server", () => ({
  requireStaff: vi.fn().mockResolvedValue({
    ok: true,
    user: { id: "actor-uuid-0001", claimedRole: "admin" },
  }),
}));

vi.mock("@/lib/audit/index", () => ({
  writeAuditRow: vi.fn().mockResolvedValue(undefined),
  writeDenied: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/ratelimit/index", () => ({
  checkAdminWriteLimit: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("@/lib/auth/step-up", () => ({
  requireStepUp: vi.fn(),
  _resetCacheForTest: vi.fn(),
}));

import { saveDocument } from "@/lib/admin/actions/documents";

const CAT_ID = "dd000001-0000-4000-8000-000000000099";

describe("saveDocument — AC4: price only on create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires priceLkr on create", async () => {
    // Category mock (won't reach it — validation fails first)
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    const result = await saveDocument({
      title: "Safety Sign A",
      docKind: "safety_sign",
      categoryId: CAT_ID,
      // no priceLkr — must fail
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("validation_failed");
      expect((result as { reason: string }).reason).toMatch(/price/i);
    }
  });

  it("ignores priceLkr on edit (never updates price_cents)", async () => {
    const existingRow = {
      id: "edit-doc-aa01-0000-4000-8000-000000000001",
      slug: "existing-slug",
      status: "draft",
      updated_at: "2026-01-01T00:00:00.000Z",
      price_cents: 100000,
    };

    const updateCapture: Record<string, unknown>[] = [];
    let fromCallCount = 0;

    mockFrom.mockImplementation((table: string) => {
      fromCallCount++;
      if (table === "documents") {
        if (fromCallCount === 1) {
          // Fetch existing row
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: existingRow, error: null }),
          };
        }
        if (fromCallCount === 2) {
          // Slug clash check
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }
        // Update call — capture payload
        return {
          update: vi.fn().mockImplementation((data: Record<string, unknown>) => {
            updateCapture.push({ ...data });
            return {
              eq: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: { id: existingRow.id, slug: "existing-slug", updated_at: "2026-01-02T00:00:00.000Z" },
                error: null,
              }),
            };
          }),
        };
      }
      if (table === "categories") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: CAT_ID }, error: null }),
        };
      }
      if (table === "slug_redirects") {
        return {
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          insert: vi.fn().mockResolvedValue({ error: null }),
          select: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
        };
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
    });

    await saveDocument({
      documentId: "edit-doc-aa01-0000-4000-8000-000000000001",
      title: "Updated Title",
      docKind: "checklist",
      categoryId: CAT_ID,
      priceLkr: 99999, // must be ignored on edit
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    // The update payload must not include price_cents
    for (const payload of updateCapture) {
      expect(payload).not.toHaveProperty("price_cents");
    }
  });
});
