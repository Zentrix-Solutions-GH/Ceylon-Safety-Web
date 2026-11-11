/**
 * S-071 AC5, EC2, EC3: Integration tests for servePreviewFile with real Supabase.
 * These tests call servePreviewFile directly (the route's DB+business-logic layer).
 * R2 streaming is not tested here — that is the route's responsibility.
 * Run with: DOCUMENTS_PUBLIC_DB_TEST=1 npx vitest run app/api/preview/__tests__/route.db.test.ts
 * Requires: local Supabase running with dev seed applied.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

const ENABLED = process.env.DOCUMENTS_PUBLIC_DB_TEST === "1";

// Seed data:
// Doc 1: 02000050-0000-0000-0000-000000000001 (fire-safety-checklist)
//   Files: en/full (pptx), si/full (pptx), ta/full (pptx), en/preview (pdf, sort_order=1)
// Doc 2: 02000050-0000-0000-0000-000000000002 (first-aid-toolbox-talk)
//   Files: en/full (pptx), si/full (pptx), ta/full (pptx), en/preview (pdf, sort_order=1)
// File row 02000051-0000-0000-0000-000000000001 is doc1 en FULL — never served by preview

const DOC_FIRE_ID = "02000050-0000-0000-0000-000000000001";
const FILE_FIRE_FULL_EN_ID = "02000051-0000-0000-0000-000000000001";

describe.skipIf(!ENABLED)("servePreviewFile — DB integration (AC5, EC2, EC3)", () => {
  it("AC5: returns file_key for a valid documentId with an en preview at page 1", async () => {
    const { servePreviewFile } = await import("@/lib/documents/public");
    const result = await servePreviewFile(DOC_FIRE_ID, "en", 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(typeof result.fileKey).toBe("string");
    expect(result.fileKey.length).toBeGreaterThan(0);
    // The file key must NEVER expose a 'full' path
    expect(result.fileKey).not.toContain("/full/");
  });

  it("EC2: documentId that matches a full-file row (not preview) returns not_found", async () => {
    // The full-file row has document_id = DOC_FIRE_ID but kind = 'full'.
    // servePreviewFile must NEVER return it.
    const { servePreviewFile } = await import("@/lib/documents/public");
    // We use the FULL file's own id as the documentId — it won't match documents.id
    const result = await servePreviewFile(FILE_FIRE_FULL_EN_ID, "en", 1);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("not_found");
  });

  it("EC2: random UUID returns not_found with no hint of a full file", async () => {
    const { servePreviewFile } = await import("@/lib/documents/public");
    const result = await servePreviewFile("ffffffff-ffff-ffff-ffff-ffffffffffff", "en", 1);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("not_found");
  });

  it("EC3: preview for language 'si' (not in seed) returns not_found — no English fallback", async () => {
    // Doc 1 has only an 'en' preview row in the seed; 'si' has no preview.
    const { servePreviewFile } = await import("@/lib/documents/public");
    const result = await servePreviewFile(DOC_FIRE_ID, "si", 1);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("not_found");
  });

  it("AC5: page 2 returns not_found when only page 1 exists in seed", async () => {
    const { servePreviewFile } = await import("@/lib/documents/public");
    const result = await servePreviewFile(DOC_FIRE_ID, "en", 2);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("not_found");
  });

  it("EC1: hidden (draft) document returns not_found on preview route", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminClient = createClient<any>(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
    );

    const hiddenId = "02000050-ffff-0000-0000-000000000090";
    const catRes = await adminClient.from("categories").select("id").eq("slug", "fire-safety").single();
    await adminClient.from("documents").upsert({
      id: hiddenId,
      slug: "hidden-preview-test-ec1",
      title: "Hidden Preview Doc",
      doc_kind: "checklist",
      file_format: "pptx",
      price_cents: 1000,
      category_id: catRes.data?.id,
      status: "draft",
    }, { onConflict: "id" });
    await adminClient.from("document_files").upsert({
      id: "02000051-ffff-0000-0000-000000000090",
      document_id: hiddenId,
      language: "en",
      kind: "preview",
      format: "pdf",
      file_key: "previews/hidden-preview-test.pdf",
      size_bytes: 0,
      version: 1,
      is_current: true,
      status: "ready",
      sort_order: 1,
    }, { onConflict: "id" });

    const { servePreviewFile } = await import("@/lib/documents/public");
    try {
      const result = await servePreviewFile(hiddenId, "en", 1);
      expect(result.ok).toBe(false);
      expect((result as { code: string }).code).toBe("not_found");
    } finally {
      await adminClient.from("document_files").delete().eq("id", "02000051-ffff-0000-0000-000000000090");
      await adminClient.from("documents").delete().eq("id", hiddenId);
    }
  });
});
