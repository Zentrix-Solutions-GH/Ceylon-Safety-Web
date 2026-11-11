// AC10: audit rows written to admin_audit_log for each write action.
// This is NOT mocked — writeAuditRow runs for real and we query admin_audit_log
// to confirm the row exists.
//
// Requires: actor profile exists (Dev Admin from seed.dev.sql:
//   02000010-0000-0000-0000-000000000003)
// Also requires: document.save and document.slug_change in the audit CHECK constraint
//   (migration 20261110000001_audit_document_events.sql).
//
// To run:
//   supabase start
//   DOCUMENTS_DB_TEST=1 npx vitest run lib/admin/actions/__tests__/documents.audit.db.test.ts

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Use the Dev Admin profile from seed.dev.sql — actor_id must exist in profiles FK.
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

// Do NOT mock writeAuditRow — this test verifies the row is actually written.

vi.mock("@/lib/auth/step-up", () => ({
  requireStepUp: vi.fn().mockResolvedValue(undefined),
  _resetCacheForTest: vi.fn(),
}));

const ENABLED = process.env.DOCUMENTS_DB_TEST === "1";
const ACTOR_ID = "02000010-0000-0000-0000-000000000003";

describe.skipIf(!ENABLED)("document actions — audit rows (requires local Supabase + seed)", () => {
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
    // Clean audit rows for our test documents
    await supabase.from("admin_audit_log").delete().eq("actor_id", ACTOR_ID).in("entity_id", createdIds);
    await supabase.from("slug_redirects").delete().in("entity_id", createdIds);
    await supabase.from("documents").delete().in("id", createdIds);
  });

  it("AC10: saveDocument (create) writes a document.save audit row", async () => {
    const { saveDocument } = await import("@/lib/admin/actions/documents");
    const { createSupabaseServiceRoleClient } = await import("@/lib/supabase/server");
    const supabase = createSupabaseServiceRoleClient();

    const result = await saveDocument({
      title: "Audit Test Create AC10",
      docKind: "checklist",
      categoryId: catId,
      priceLkr: 1000,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    createdIds.push(result.documentId);

    const { data: auditRow } = await supabase
      .from("admin_audit_log")
      .select("action, entity_id, actor_id")
      .eq("action", "document.save")
      .eq("entity_id", result.documentId)
      .eq("actor_id", ACTOR_ID)
      .single();

    expect(auditRow).not.toBeNull();
    expect(auditRow?.action).toBe("document.save");
    expect(auditRow?.entity_id).toBe(result.documentId);
  });

  it("AC10: saveDocument (edit) writes a document.save audit row", async () => {
    const { saveDocument } = await import("@/lib/admin/actions/documents");
    const { createSupabaseServiceRoleClient } = await import("@/lib/supabase/server");
    const supabase = createSupabaseServiceRoleClient();

    const created = await saveDocument({
      title: "Audit Test Edit AC10",
      docKind: "checklist",
      categoryId: catId,
      priceLkr: 1000,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    createdIds.push(created.documentId);

    const edited = await saveDocument({
      documentId: created.documentId,
      title: "Audit Test Edit AC10 — Updated",
      docKind: "checklist",
      categoryId: catId,
      updatedAt: created.updatedAt,
    });
    expect(edited.ok).toBe(true);

    // There should be at least 2 document.save rows (create + edit)
    const { data: rows } = await supabase
      .from("admin_audit_log")
      .select("id")
      .eq("action", "document.save")
      .eq("entity_id", created.documentId)
      .eq("actor_id", ACTOR_ID);

    expect((rows ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("AC10: changeDocumentPrice writes a price.change audit row", async () => {
    const { saveDocument, changeDocumentPrice, _resetDailyDropCountForTest } = await import(
      "@/lib/admin/actions/documents"
    );
    const { createSupabaseServiceRoleClient } = await import("@/lib/supabase/server");
    const supabase = createSupabaseServiceRoleClient();
    _resetDailyDropCountForTest(ACTOR_ID);

    const created = await saveDocument({
      title: "Audit Test Price AC10",
      docKind: "checklist",
      categoryId: catId,
      priceLkr: 1000,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    createdIds.push(created.documentId);

    const priceResult = await changeDocumentPrice({
      documentId: created.documentId,
      newPriceLkr: 1200,
      confirmedLargeChange: false,
      authenticatorCode: "123456",
    });
    expect(priceResult.ok).toBe(true);

    const { data: auditRow } = await supabase
      .from("admin_audit_log")
      .select("action, entity_id, actor_id")
      .eq("action", "price.change")
      .eq("entity_id", created.documentId)
      .eq("actor_id", ACTOR_ID)
      .single();

    expect(auditRow).not.toBeNull();
    expect(auditRow?.action).toBe("price.change");
  });
});
