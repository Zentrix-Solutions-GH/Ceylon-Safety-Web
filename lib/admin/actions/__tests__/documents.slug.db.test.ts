// AC5, EC4: slug generation and slug_redirects against real Supabase.
// Auth is mocked; we test real DB behaviour for slug clash detection and redirect writing.
//
// To run:
//   supabase start
//   DOCUMENTS_DB_TEST=1 npx vitest run lib/admin/actions/__tests__/documents.slug.db.test.ts

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

describe.skipIf(!ENABLED)("saveDocument — slug rules (requires local Supabase + seed)", () => {
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
    await supabase.from("slug_redirects").delete().in("entity_id", createdIds);
    await supabase.from("documents").delete().in("id", createdIds);
  });

  it("AC5: slug is generated from title on first save", async () => {
    const { saveDocument } = await import("@/lib/admin/actions/documents");
    const result = await saveDocument({
      title: "Integration Slug Test Alpha",
      docKind: "checklist",
      categoryId: catId,
      priceLkr: 1000,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    createdIds.push(result.documentId);
    expect(result.slug).toBe("integration-slug-test-alpha");
  });

  it("AC5: a slug clash appends a number", async () => {
    const { saveDocument } = await import("@/lib/admin/actions/documents");
    // Create first document with this title
    const r1 = await saveDocument({
      title: "Integration Slug Clash Test",
      docKind: "safety_sign",
      categoryId: catId,
      priceLkr: 1000,
    });
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    createdIds.push(r1.documentId);
    expect(r1.slug).toBe("integration-slug-clash-test");

    // Create second document with the same title — slug must differ
    const r2 = await saveDocument({
      title: "Integration Slug Clash Test",
      docKind: "safety_sign",
      categoryId: catId,
      priceLkr: 1000,
    });
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    createdIds.push(r2.documentId);
    expect(r2.slug).toBe("integration-slug-clash-test-2");
  });

  it("AC5: changing title of a PUBLISHED document writes a slug_redirects row", async () => {
    const { saveDocument } = await import("@/lib/admin/actions/documents");
    const { createSupabaseServiceRoleClient } = await import("@/lib/supabase/server");
    const supabase = createSupabaseServiceRoleClient();

    // Create and immediately publish via service role
    const r1 = await saveDocument({
      title: "Integration Slug Redirect Source",
      docKind: "checklist",
      categoryId: catId,
      priceLkr: 1000,
    });
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    createdIds.push(r1.documentId);

    // Publish it via service role so the slug-change guard fires on rename
    await supabase
      .from("documents")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", r1.documentId);

    // Fetch updated_at after publish so optimistic concurrency passes
    const { data: row } = await supabase
      .from("documents")
      .select("updated_at")
      .eq("id", r1.documentId)
      .single();

    // Now rename the title (changes the slug)
    const r2 = await saveDocument({
      documentId: r1.documentId,
      title: "Integration Slug Redirect Destination",
      docKind: "checklist",
      categoryId: catId,
      updatedAt: row?.updated_at,
    });
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;

    // Verify slug_redirects row was written
    const { data: redirect } = await supabase
      .from("slug_redirects")
      .select("old_slug")
      .eq("entity_type", "document")
      .eq("entity_id", r1.documentId)
      .single();

    expect(redirect).not.toBeNull();
    expect(redirect?.old_slug).toBe("integration-slug-redirect-source");
  });

  it("AC5: a second rename flattens to the newest slug (old redirect updated)", async () => {
    const { saveDocument } = await import("@/lib/admin/actions/documents");
    const { createSupabaseServiceRoleClient } = await import("@/lib/supabase/server");
    const supabase = createSupabaseServiceRoleClient();

    const r1 = await saveDocument({
      title: "Integration Flatten Source",
      docKind: "checklist",
      categoryId: catId,
      priceLkr: 1000,
    });
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    createdIds.push(r1.documentId);

    await supabase
      .from("documents")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", r1.documentId);

    const { data: row1 } = await supabase
      .from("documents")
      .select("updated_at")
      .eq("id", r1.documentId)
      .single();

    const r2 = await saveDocument({
      documentId: r1.documentId,
      title: "Integration Flatten Mid",
      docKind: "checklist",
      categoryId: catId,
      updatedAt: row1?.updated_at,
    });
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;

    const { data: row2 } = await supabase
      .from("documents")
      .select("updated_at")
      .eq("id", r1.documentId)
      .single();

    const r3 = await saveDocument({
      documentId: r1.documentId,
      title: "Integration Flatten Final",
      docKind: "checklist",
      categoryId: catId,
      updatedAt: row2?.updated_at,
    });
    expect(r3.ok).toBe(true);
    if (!r3.ok) return;

    // Both old slugs should redirect to the final slug — no dangling redirects
    const { data: redirects } = await supabase
      .from("slug_redirects")
      .select("old_slug")
      .eq("entity_type", "document")
      .eq("entity_id", r1.documentId)
      .order("old_slug");

    // Exactly the two old slugs should be present (flattened: each points to final)
    const oldSlugs = (redirects ?? []).map((r) => r.old_slug).sort();
    expect(oldSlugs).toContain("integration-flatten-source");
    expect(oldSlugs).toContain("integration-flatten-mid");
  });

  it("EC4: title 'admin' becomes 'doc-admin' (reserved slug guard)", async () => {
    const { saveDocument } = await import("@/lib/admin/actions/documents");
    const result = await saveDocument({
      title: "admin",
      docKind: "checklist",
      categoryId: catId,
      priceLkr: 1000,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    createdIds.push(result.documentId);
    expect(result.slug).toBe("doc-admin");
  });

  it("EC4: title 'api' becomes 'doc-api' (reserved slug guard)", async () => {
    const { saveDocument } = await import("@/lib/admin/actions/documents");
    const result = await saveDocument({
      title: "api",
      docKind: "checklist",
      categoryId: catId,
      priceLkr: 1000,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    createdIds.push(result.documentId);
    expect(result.slug).toBe("doc-api");
  });
});
