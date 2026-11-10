// AC6, EC5: optimistic concurrency against real Supabase.
// The DB-level concurrency check uses .eq("updated_at", timestamp) on the UPDATE;
// if the row changed between fetch and update, 0 rows are affected → version_conflict.
//
// To run:
//   supabase start
//   DOCUMENTS_DB_TEST=1 npx vitest run lib/admin/actions/__tests__/documents.save.db.test.ts

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/server", () => ({
  requireStaff: vi.fn().mockResolvedValue({
    ok: true,
    user: {
      id: "02000010-0000-0000-0000-000000000003",
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

describe.skipIf(!ENABLED)("saveDocument — version_conflict (requires local Supabase + seed)", () => {
  const createdIds: string[] = [];
  let catId: string;

  beforeAll(async () => {
    const { createSupabaseServiceRoleClient } = await import("@/lib/supabase/server");
    const supabase = createSupabaseServiceRoleClient();
    const { data } = await supabase.from("categories").select("id").eq("slug", "fire-safety").single();
    catId = data?.id ?? "";
  });

  afterAll(async () => {
    if (!createdIds.length) return;
    const { createSupabaseServiceRoleClient } = await import("@/lib/supabase/server");
    const supabase = createSupabaseServiceRoleClient();
    await supabase.from("documents").delete().in("id", createdIds);
  });

  it("AC6: edit with correct updated_at succeeds", async () => {
    const { saveDocument } = await import("@/lib/admin/actions/documents");

    // Create
    const created = await saveDocument({
      title: "Concurrency Test AC6 Correct",
      docKind: "checklist",
      categoryId: catId,
      priceLkr: 1000,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    createdIds.push(created.documentId);

    // Edit with the updatedAt returned by create
    const edited = await saveDocument({
      documentId: created.documentId,
      title: "Concurrency Test AC6 Correct — Edited",
      docKind: "checklist",
      categoryId: catId,
      updatedAt: created.updatedAt,
    });
    expect(edited.ok).toBe(true);
  });

  it("AC6: edit with stale updated_at returns version_conflict (DB-level check)", async () => {
    const { saveDocument } = await import("@/lib/admin/actions/documents");
    const { createSupabaseServiceRoleClient } = await import("@/lib/supabase/server");
    const supabase = createSupabaseServiceRoleClient();

    const created = await saveDocument({
      title: "Concurrency Test AC6 Stale",
      docKind: "checklist",
      categoryId: catId,
      priceLkr: 1000,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    createdIds.push(created.documentId);

    // Advance updated_at directly in DB (simulates another writer)
    await supabase
      .from("documents")
      .update({ title: "Concurrency Test AC6 Stale — Touched" })
      .eq("id", created.documentId);

    // Try to edit with the original (now stale) timestamp
    const result = await saveDocument({
      documentId: created.documentId,
      title: "Concurrency Test AC6 Stale — My Edit",
      docKind: "checklist",
      categoryId: catId,
      updatedAt: created.updatedAt,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("version_conflict");
  });

  it("EC5: two concurrent admins — the second gets version_conflict", async () => {
    const { saveDocument } = await import("@/lib/admin/actions/documents");

    const created = await saveDocument({
      title: "Concurrency Test EC5",
      docKind: "checklist",
      categoryId: catId,
      priceLkr: 1000,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    createdIds.push(created.documentId);

    // Admin A edits first and succeeds
    const adminA = await saveDocument({
      documentId: created.documentId,
      title: "Concurrency Test EC5 — Admin A Edit",
      docKind: "checklist",
      categoryId: catId,
      updatedAt: created.updatedAt,
    });
    expect(adminA.ok).toBe(true);

    // Admin B uses the original updatedAt (stale — Admin A already changed it)
    const adminB = await saveDocument({
      documentId: created.documentId,
      title: "Concurrency Test EC5 — Admin B Edit",
      docKind: "checklist",
      categoryId: catId,
      updatedAt: created.updatedAt,
    });
    expect(adminB.ok).toBe(false);
    if (!adminB.ok) expect(adminB.code).toBe("version_conflict");
  });
});
