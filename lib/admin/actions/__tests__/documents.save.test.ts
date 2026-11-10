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

import { saveDocument, getDocument, listDocuments } from "@/lib/admin/actions/documents";
import { requireStaff } from "@/lib/auth/server";
import { checkAdminWriteLimit } from "@/lib/ratelimit/index";
import { writeAuditRow } from "@/lib/audit/index";

// Zod 4 UUID: version digit at position 15 (13th char in bare hex) must be 1-8.
// These are version-4 UUIDs: char 15 = '4', variant byte (char 20) = '8'.
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
    // AC10: audit row must be written on every edit
    expect(vi.mocked(writeAuditRow)).toHaveBeenCalledWith(
      expect.objectContaining({ action: "document.save" })
    );
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

describe("getDocument — AC2: not_found", () => {
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

  it("returns not_found for an invalid UUID (skips DB)", async () => {
    const result = await getDocument("not-a-uuid");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_found");
  });

  it("returns not_found when DB row does not exist (PGRST116)", async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { code: "PGRST116", message: "not found" },
      }),
    });

    const result = await getDocument(DOC_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_found");
  });
});

describe("listDocuments / getDocument — EC6: role gate on read path", () => {
  beforeEach(() => vi.clearAllMocks());

  it("listDocuments returns not_allowed for a Maintainer (no documents.* permission)", async () => {
    vi.mocked(requireStaff).mockResolvedValue({ ok: false, code: "not_allowed" } as never);
    const { listDocuments } = await import("@/lib/admin/actions/documents");
    const result = await listDocuments({});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_allowed");
  });

  it("getDocument returns not_allowed for an unauthenticated caller", async () => {
    vi.mocked(requireStaff).mockResolvedValue({ ok: false, code: "not_allowed" } as never);
    const result = await getDocument(DOC_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_allowed");
  });
});

describe("saveDocument — AC10: document.slug_change audit row on published rename", () => {
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

  it("writes document.slug_change audit row when a published doc's slug changes", async () => {
    // published existing row with slug "old-title"
    const PUBLISHED_ROW = {
      id: DOC_ID,
      slug: "old-title",
      status: "published",
      updated_at: "2026-01-01T00:00:00.000Z",
      price_cents: 100000,
    };

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
            single: vi.fn().mockResolvedValue({ data: PUBLISHED_ROW, error: null }),
          };
        }
        if (docCalls.count === 2) {
          // Slug clash check — no clash
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }
        // Update — returns new slug
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: DOC_ID, slug: "new-title", updated_at: "2026-01-02T00:00:00.000Z" },
              error: null,
            }),
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
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnThis() }),
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis() };
    });

    const result = await saveDocument({
      documentId: DOC_ID,
      title: "New Title",
      docKind: "checklist",
      categoryId: CAT_ID,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(result.ok).toBe(true);
    // AC10: both document.save and document.slug_change must be written
    expect(vi.mocked(writeAuditRow)).toHaveBeenCalledWith(
      expect.objectContaining({ action: "document.save" })
    );
    expect(vi.mocked(writeAuditRow)).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "document.slug_change",
        before: { slug: "old-title" },
        after: { slug: "new-title" },
      })
    );
  });
});

describe("saveDocument — EC4: reserved slug on create", () => {
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

  it("prefixes doc- when title generates a reserved slug", async () => {
    const insertCapture: Record<string, unknown>[] = [];
    mockFrom.mockImplementation((table: string) => {
      if (table === "documents") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockResolvedValue({ data: [], error: null }),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
          insert: vi.fn().mockImplementation((data: Record<string, unknown>) => {
            insertCapture.push({ ...data });
            return {
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: { id: "bb010001-0000-4000-8000-000000000001", slug: "doc-admin", updated_at: "2026-01-01T00:00:00.000Z" },
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

    // "admin" title → generateSlug → "admin" → reserved → "doc-admin"
    const result = await saveDocument({
      title: "admin",
      docKind: "checklist",
      categoryId: CAT_ID,
      priceLkr: 1000,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.slug).toBe("doc-admin");
    }
  });
});
