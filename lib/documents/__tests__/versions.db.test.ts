// S-070 AC4, EC3, EC4: version switching and single-current-row invariant.
// Tests the complete_document_file RPC and the unique-index behaviour.
//
// Requires: local Supabase running (`supabase start`) with the seed applied.
// Skips when DOCUMENTS_FILES_DB_TEST env var is not "1".
//
// To run:
//   supabase start
//   DOCUMENTS_FILES_DB_TEST=1 npx vitest run lib/documents/__tests__/versions.db.test.ts

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

vi.mock("@/lib/r2/storage", () => ({
  presignedPut: vi.fn().mockResolvedValue("https://r2.test/put"),
  headObject: vi.fn().mockResolvedValue({ contentLength: 5_000_000 }),
  getObjectBytes: vi.fn().mockImplementation((_bucket: string, _key: string, length: number) => {
    // Return PPTX magic bytes for the first 8 bytes; zero-padded to full length.
    const buf = new Uint8Array(length);
    buf[0] = 0x50; buf[1] = 0x4b; buf[2] = 0x03; buf[3] = 0x04;
    return Promise.resolve(buf);
  }),
  deleteObject: vi.fn().mockResolvedValue(undefined),
}));

const ENABLED = process.env.DOCUMENTS_FILES_DB_TEST === "1";

describe.skipIf(!ENABLED)("document file versions — integration (requires local Supabase + seed)", () => {
  let docId: string;
  let supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createSupabaseServiceRoleClient>>;

  beforeAll(async () => {
    const { createSupabaseServiceRoleClient } = await import("@/lib/supabase/server");
    supabase = createSupabaseServiceRoleClient();

    // Create a minimal document to attach files to.
    const { saveDocument } = await import("@/lib/admin/actions/documents");
    const { data: cat } = await supabase.from("categories").select("id").limit(1).single();
    if (!cat) throw new Error("No category in seed — run supabase db reset");

    const result = await saveDocument({
      title: "Version Test Doc",
      categoryId: cat.id,
      priceLkr: 10,
      docKind: "checklist",
      description: null,
      coverImageKey: null,
      pageCount: null,
      seoTitle: null,
      seoDescription: null,
    });
    if (!result.ok) throw new Error("saveDocument failed: " + JSON.stringify(result));
    docId = result.documentId;
  });

  afterAll(async () => {
    if (docId) {
      await supabase.from("document_files").delete().eq("document_id", docId);
      await supabase.from("documents").delete().eq("id", docId);
    }
  });

  it("AC4: re-upload creates version 2; only one is_current=true row per slot", async () => {
    const { startDocumentFileUpload, completeDocumentFileUpload } = await import("@/lib/documents/upload");

    // Upload v1
    const start1 = await startDocumentFileUpload({ documentId: docId, kind: "full", language: "en", sortOrder: 1, format: "pptx", sizeBytes: 5_000_000 });
    expect(start1.ok).toBe(true);
    if (!start1.ok) return;
    const complete1 = await completeDocumentFileUpload(start1.upload.fileId);
    expect(complete1.ok).toBe(true);

    // Upload v2 for the same slot
    const start2 = await startDocumentFileUpload({ documentId: docId, kind: "full", language: "en", sortOrder: 1, format: "pptx", sizeBytes: 5_000_000 });
    expect(start2.ok).toBe(true);
    if (!start2.ok) return;
    const complete2 = await completeDocumentFileUpload(start2.upload.fileId);
    expect(complete2.ok).toBe(true);

    // Exactly one is_current=true row for (docId, full, en, sort_order=1)
    const { data: current } = await supabase
      .from("document_files")
      .select("id, version, is_current")
      .eq("document_id", docId)
      .eq("kind", "full")
      .eq("language", "en")
      .eq("sort_order", 1)
      .eq("is_current", true);

    expect(current).toHaveLength(1);
    expect(current![0].version).toBe(2);

    // v1 row still exists but is_current=false (EC3: earlier buyers can still reference it)
    const { data: old } = await supabase
      .from("document_files")
      .select("is_current, version")
      .eq("document_id", docId)
      .eq("kind", "full")
      .eq("language", "en")
      .eq("sort_order", 1)
      .eq("is_current", false);

    expect(old!.some((r) => r.version === 1)).toBe(true);
  });

  it("EC4: concurrent uploads for the same slot: second completeDocumentFileUpload still results in one current row", async () => {
    const { startDocumentFileUpload, completeDocumentFileUpload } = await import("@/lib/documents/upload");

    // Start two uploads for si/full/sort_order=1 without completing either first
    const startA = await startDocumentFileUpload({ documentId: docId, kind: "full", language: "si", sortOrder: 1, format: "pptx", sizeBytes: 5_000_000 });
    const startB = await startDocumentFileUpload({ documentId: docId, kind: "full", language: "si", sortOrder: 1, format: "pptx", sizeBytes: 5_000_000 });
    expect(startA.ok).toBe(true);
    expect(startB.ok).toBe(true);
    if (!startA.ok || !startB.ok) return;

    // Complete both — the RPC ensures each completes atomically
    await completeDocumentFileUpload(startA.upload.fileId);
    await completeDocumentFileUpload(startB.upload.fileId);

    const { data: current } = await supabase
      .from("document_files")
      .select("id")
      .eq("document_id", docId)
      .eq("kind", "full")
      .eq("language", "si")
      .eq("is_current", true);

    expect(current).toHaveLength(1);
  });
});
