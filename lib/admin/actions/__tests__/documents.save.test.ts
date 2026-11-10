// AC4, AC6, AC11, EC6: saveDocument unit tests.
// No DB needed — mocks the supabase client and auth helpers.

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
    user: {
      id: "actor-uuid-0001",
      email: "admin@test.com",
      claimedRole: "admin",
      hasAuthenticatorLevel: true,
      hasTotpEnrolled: true,
    },
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
import { requireStaff } from "@/lib/auth/server";
import { checkAdminWriteLimit } from "@/lib/ratelimit/index";

const CAT_ID = "dd000001-0000-4000-8000-000000000099";
const DOC_ID = "aa010001-0000-4000-8000-000000000001";

const EXISTING_ROW = {
  id: DOC_ID,
  slug: "existing-slug",
  status: "draft",
  updated_at: "2026-01-01T00:00:00.000Z",
  price_cents: 100000,
};


describe("saveDocument — AC4: price only on create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireStaff).mockResolvedValue({
      ok: true,
      user: {
        id: "actor-uuid-0001",
        email: "admin@test.com",
        claimedRole: "admin",
        hasAuthenticatorLevel: true,
        hasTotpEnrolled: true,
      },
    });
    vi.mocked(checkAdminWriteLimit).mockResolvedValue({ ok: true });
  });

  it("requires priceLkr on create", async () => {
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
    const updateCapture: Record<string, unknown>[] = [];
    // Track per-table: documents call order is: (1) fetch, (2) slug-clash, (3) update
    const docCalls = { count: 0 };

    mockFrom.mockImplementation((table: string) => {
      if (table === "documents") {
        docCalls.count++;
        if (docCalls.count === 1) {
          // Fetch existing row
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: EXISTING_ROW, error: null }),
          };
        }
        if (docCalls.count === 2) {
          // Slug clash check (clashSafeDocumentSlug)
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }
        // Update call
        return {
          update: vi.fn().mockImplementation((data: Record<string, unknown>) => {
            updateCapture.push({ ...data });
            return {
              eq: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: { id: DOC_ID, slug: "existing-slug", updated_at: "2026-01-02T00:00:00.000Z" },
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
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis() };
    });

    const result = await saveDocument({
      documentId: DOC_ID,
      title: "Updated Title",
      docKind: "checklist",
      categoryId: CAT_ID,
      priceLkr: 99999,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    // Confirm we actually reached the update (not a Zod or early-exit failure)
    expect(result.ok).toBe(true);
    expect(updateCapture.length).toBeGreaterThan(0);
    for (const payload of updateCapture) {
      expect(payload).not.toHaveProperty("price_cents");
    }
  });
});

describe("saveDocument — AC6: optimistic concurrency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireStaff).mockResolvedValue({
      ok: true,
      user: {
        id: "actor-uuid-0001",
        email: "admin@test.com",
        claimedRole: "admin",
        hasAuthenticatorLevel: true,
        hasTotpEnrolled: true,
      },
    });
    vi.mocked(checkAdminWriteLimit).mockResolvedValue({ ok: true });
  });

  it("returns validation_failed when updatedAt is omitted on edit", async () => {
    // DB returns an existing row
    mockFrom.mockImplementation((table: string) => {
      if (table === "documents") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: EXISTING_ROW, error: null }),
        };
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis() };
    });

    const result = await saveDocument({
      documentId: DOC_ID,
      title: "New Title",
      docKind: "checklist",
      categoryId: CAT_ID,
      // updatedAt intentionally omitted on an edit
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("validation_failed");
      expect((result as { reason: string }).reason).toMatch(/updatedAt/i);
    }
  });

  it("returns version_conflict when updatedAt is stale (app-level check)", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "documents") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { ...EXISTING_ROW, updated_at: "2026-02-01T00:00:00.000Z" }, // DB row is newer
            error: null,
          }),
        };
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis() };
    });

    const result = await saveDocument({
      documentId: DOC_ID,
      title: "New Title",
      docKind: "checklist",
      categoryId: CAT_ID,
      updatedAt: "2026-01-01T00:00:00.000Z", // stale — doesn't match DB
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("version_conflict");
  });
});

describe("saveDocument — EC6: role removed", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns not_allowed when requireStaff fails", async () => {
    vi.mocked(requireStaff).mockResolvedValue({ ok: false, code: "not_allowed" } as never);

    const result = await saveDocument({
      title: "Safety Sign A",
      docKind: "safety_sign",
      categoryId: CAT_ID,
      priceLkr: 1000,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_allowed");
  });
});

describe("saveDocument — AC11: rate limit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireStaff).mockResolvedValue({
      ok: true,
      user: {
        id: "actor-uuid-0001",
        email: "admin@test.com",
        claimedRole: "admin",
        hasAuthenticatorLevel: true,
        hasTotpEnrolled: true,
      },
    });
  });

  it("returns rate_limited when checkAdminWriteLimit refuses", async () => {
    vi.mocked(checkAdminWriteLimit).mockResolvedValue({ ok: false } as never);

    const result = await saveDocument({
      title: "Safety Sign A",
      docKind: "safety_sign",
      categoryId: CAT_ID,
      priceLkr: 1000,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("rate_limited");
  });
});
