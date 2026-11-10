// AC1, AC2: listDocuments and getDocument against real Supabase.
// Auth is mocked (requireStaff) so we test real DB query correctness, not the
// auth layer (that is covered by S-015 and unit tests in EC6).
//
// To run:
//   supabase start
//   DOCUMENTS_DB_TEST=1 npx vitest run lib/admin/actions/__tests__/documents.perm.db.test.ts

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Mock requireStaff so tests don't need a real browser session.
// Role enforcement is unit-tested in EC6; here we verify DB queries return correct shapes.
vi.mock("@/lib/auth/server", () => ({
  requireStaff: vi.fn().mockResolvedValue({
    ok: true,
    user: {
      id: "02000010-0000-0000-0000-000000000003", // Dev Admin from seed.dev.sql
      email: "admin@dev.invalid",
      claimedRole: "admin",
      hasAuthenticatorLevel: true,
      hasTotpEnrolled: true,
    },
  }),
}));

vi.mock("@/lib/ratelimit/index", () => ({
  checkAdminWriteLimit: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("@/lib/audit/index", () => ({
  writeAuditRow: vi.fn().mockResolvedValue(undefined),
  writeDenied: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/auth/step-up", () => ({
  requireStepUp: vi.fn().mockResolvedValue(undefined),
  _resetCacheForTest: vi.fn(),
}));

const ENABLED = process.env.DOCUMENTS_DB_TEST === "1";

describe.skipIf(!ENABLED)("listDocuments / getDocument — real Supabase (requires local Supabase + seed)", () => {
  let seededDocId: string | null = null;

  beforeAll(async () => {
    // Insert a test document via saveDocument so slug generation is exercised.
    const { saveDocument } = await import("@/lib/admin/actions/documents");
    const { createSupabaseServiceRoleClient } = await import("@/lib/supabase/server");
    const supabase = createSupabaseServiceRoleClient();

    // Grab a real category id from the seeded categories
    const { data: cat } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", "fire-safety")
      .single();

    if (!cat) return;

    const result = await saveDocument({
      title: "Integration Test Document AC1 AC2",
      docKind: "checklist",
      categoryId: cat.id,
      priceLkr: 1500,
    });

    if (result.ok) seededDocId = result.documentId;
  });

  afterAll(async () => {
    if (!seededDocId) return;
    const { createSupabaseServiceRoleClient } = await import("@/lib/supabase/server");
    const supabase = createSupabaseServiceRoleClient();
    await supabase.from("documents").delete().eq("id", seededDocId);
  });

  it("AC1: listDocuments returns rows with required fields (no file_key)", async () => {
    const { listDocuments } = await import("@/lib/admin/actions/documents");
    const result = await listDocuments({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(typeof result.total).toBe("number");
    expect(result.pageSize).toBe(25);
    expect(Array.isArray(result.rows)).toBe(true);

    for (const row of result.rows) {
      expect(row).toHaveProperty("id");
      expect(row).toHaveProperty("title");
      expect(row).toHaveProperty("slug");
      expect(row).toHaveProperty("docKind");
      expect(row).toHaveProperty("priceCents");
      expect(row).toHaveProperty("status");
      expect(row).toHaveProperty("languageSlots");
      // AC12: no file key
      expect(row).not.toHaveProperty("fileKey");
      expect(row).not.toHaveProperty("file_key");
    }
  });

  it("AC1: listDocuments can filter by status", async () => {
    const { listDocuments } = await import("@/lib/admin/actions/documents");
    const result = await listDocuments({ status: "draft" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const row of result.rows) {
      expect(row.status).toBe("draft");
    }
  });

  it("AC1: listDocuments paginates — page 2 is different from page 1", async () => {
    const { listDocuments } = await import("@/lib/admin/actions/documents");
    const page1 = await listDocuments({ page: 1 });
    const page2 = await listDocuments({ page: 2 });
    expect(page1.ok).toBe(true);
    expect(page2.ok).toBe(true);
    if (!page1.ok || !page2.ok) return;
    if (page1.total <= 25) return; // only one page of data — skip overlap check
    const ids1 = new Set(page1.rows.map((r) => r.id));
    for (const row of page2.rows) {
      expect(ids1.has(row.id)).toBe(false);
    }
  });

  it("AC2: getDocument returns a full detail record (no file_key)", async () => {
    if (!seededDocId) return;
    const { getDocument } = await import("@/lib/admin/actions/documents");
    const result = await getDocument(seededDocId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const doc = result.document;
    expect(doc.id).toBe(seededDocId);
    expect(doc.title).toBe("Integration Test Document AC1 AC2");
    expect(doc).toHaveProperty("description");
    expect(doc).toHaveProperty("coverImageKey");
    expect(doc).toHaveProperty("pageCount");
    expect(doc).toHaveProperty("previewPages");
    // AC12: no file key
    expect(doc).not.toHaveProperty("fileKey");
    expect(doc).not.toHaveProperty("file_key");
  });

  it("AC2: getDocument returns not_found for an unknown id", async () => {
    const { getDocument } = await import("@/lib/admin/actions/documents");
    const result = await getDocument("cc010001-0000-4000-8000-000000000099");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_found");
  });
});
