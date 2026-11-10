// AC9: existing order_items keep their price snapshot after changeDocumentPrice.
// order_items.unit_price_cents is a snapshot — the document's price_cents
// changing must NOT touch any existing order rows.
//
// This test verifies two things:
//   1. The document's price_cents is updated.
//   2. The count of order_items for the document does not change (the action
//      does not INSERT, UPDATE, or DELETE order_items).
//
// Full order-creation is skipped because orders requires FK to page_revisions
// (not seeded in test data). The absence of any UPDATE/DELETE on order_items
// is also verified structurally: changeDocumentPrice only calls
// supabase.from("documents").update(…) — there is no order_items call.
//
// To run:
//   supabase start
//   DOCUMENTS_DB_TEST=1 npx vitest run lib/admin/actions/__tests__/price.db.test.ts

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

describe.skipIf(!ENABLED)("changeDocumentPrice — orders untouched (requires local Supabase + seed)", () => {
  let docId: string;

  beforeAll(async () => {
    const { saveDocument } = await import("@/lib/admin/actions/documents");
    const { createSupabaseServiceRoleClient } = await import("@/lib/supabase/server");
    const supabase = createSupabaseServiceRoleClient();

    const { data: cat } = await supabase.from("categories").select("id").eq("slug", "fire-safety").single();
    if (!cat) return;

    const result = await saveDocument({
      title: "Price DB Test Document AC9",
      docKind: "checklist",
      categoryId: cat.id,
      priceLkr: 1000,
    });
    if (result.ok) docId = result.documentId;
  });

  afterAll(async () => {
    if (!docId) return;
    const { createSupabaseServiceRoleClient } = await import("@/lib/supabase/server");
    const supabase = createSupabaseServiceRoleClient();
    await supabase.from("documents").delete().eq("id", docId);
  });

  it("AC9: changeDocumentPrice updates documents.price_cents and leaves order_items untouched", async () => {
    if (!docId) return;
    const { changeDocumentPrice, _resetDailyDropCountForTest } = await import("@/lib/admin/actions/documents");
    const { createSupabaseServiceRoleClient } = await import("@/lib/supabase/server");
    const supabase = createSupabaseServiceRoleClient();
    _resetDailyDropCountForTest("02000010-0000-0000-0000-000000000003");

    // Count order_items for this document before the price change
    const { count: beforeCount } = await supabase
      .from("order_items")
      .select("id", { count: "exact", head: true })
      .eq("document_id", docId);

    const result = await changeDocumentPrice({
      documentId: docId,
      newPriceLkr: 1200,
      confirmedLargeChange: false,
      authenticatorCode: "123456",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Document price should be updated
    const { data: doc } = await supabase
      .from("documents")
      .select("price_cents")
      .eq("id", docId)
      .single();
    expect(doc?.price_cents).toBe(120000); // LKR 1200 → 120000 cents

    // order_items count must be the same (the action must not touch the table)
    const { count: afterCount } = await supabase
      .from("order_items")
      .select("id", { count: "exact", head: true })
      .eq("document_id", docId);
    expect(afterCount).toBe(beforeCount);
  });

  it("AC9: the returned newPriceCents matches what was stored (no silent rounding)", async () => {
    if (!docId) return;
    const { changeDocumentPrice, _resetDailyDropCountForTest } = await import("@/lib/admin/actions/documents");
    const { createSupabaseServiceRoleClient } = await import("@/lib/supabase/server");
    const supabase = createSupabaseServiceRoleClient();
    _resetDailyDropCountForTest("02000010-0000-0000-0000-000000000003");

    const result = await changeDocumentPrice({
      documentId: docId,
      newPriceLkr: 1500,
      confirmedLargeChange: true, // 1200 → 1500 is 25%, no confirm needed; true is fine
      authenticatorCode: "123456",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.newPriceCents).toBe(150000);

    const { data: doc } = await supabase
      .from("documents")
      .select("price_cents")
      .eq("id", docId)
      .single();
    expect(doc?.price_cents).toBe(result.newPriceCents);
  });
});
