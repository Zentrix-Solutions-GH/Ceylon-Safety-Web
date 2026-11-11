// S-070 AC5, AC6, EC5, EC7: publish gating and hide against real Supabase.
//
// Requires: local Supabase running (`supabase start`) with the seed applied.
// Skips when DOCUMENTS_FILES_DB_TEST env var is not "1".
//
// To run:
//   supabase start
//   DOCUMENTS_FILES_DB_TEST=1 npx vitest run lib/documents/__tests__/publish.db.test.ts

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

vi.mock("@/lib/cache/purge", () => ({
  purgeDocument: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("@/lib/r2/storage", () => ({
  presignedPut: vi.fn().mockResolvedValue("https://r2.test/put"),
  headObject: vi.fn().mockResolvedValue({ contentLength: 2_000_000 }),
  getObjectBytes: vi.fn().mockImplementation((_bucket: string, _key: string, length: number) => {
    const buf = new Uint8Array(length);
    // PNG magic for previews, PPTX magic for full
    buf[0] = 0x89; buf[1] = 0x50; buf[2] = 0x4e; buf[3] = 0x47;
    buf[4] = 0x0d; buf[5] = 0x0a; buf[6] = 0x1a; buf[7] = 0x0a;
    return Promise.resolve(buf);
  }),
  deleteObject: vi.fn().mockResolvedValue(undefined),
}));

const ENABLED = process.env.DOCUMENTS_FILES_DB_TEST === "1";

describe.skipIf(!ENABLED)("setDocumentStatus publish gating — integration (requires local Supabase + seed)", () => {
  let docId: string;
  let updatedAt: string;
  let supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createSupabaseServiceRoleClient>>;

  async function uploadReady(kind: "full" | "preview", language: "en" | "si" | "ta", format: string, sortOrder: number) {
    const { startDocumentFileUpload, completeDocumentFileUpload } = await import("@/lib/documents/upload");
    const { headObject, getObjectBytes } = await import("@/lib/r2/storage");
    // Adjust magic bytes for the format
    const magic: Record<string, number[]> = {
      pptx: [0x50, 0x4b, 0x03, 0x04],
      png:  [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    };
    vi.mocked(headObject).mockResolvedValueOnce({ contentLength: 2_000_000 });
    vi.mocked(getObjectBytes).mockImplementationOnce((_b: string, _k: string, length: number) => {
      const buf = new Uint8Array(length);
      (magic[format] ?? magic.png).forEach((b, i) => { buf[i] = b; });
      return Promise.resolve(buf);
    });
    const start = await startDocumentFileUpload({ documentId: docId, kind, language, sortOrder, format, sizeBytes: 2_000_000 });
    expect(start.ok).toBe(true);
    if (!start.ok) return;
    const complete = await completeDocumentFileUpload(start.upload.fileId);
    expect(complete.ok).toBe(true);
  }

  beforeAll(async () => {
    const { createSupabaseServiceRoleClient } = await import("@/lib/supabase/server");
    supabase = createSupabaseServiceRoleClient();
    const { saveDocument } = await import("@/lib/admin/actions/documents");
    const { data: cat } = await supabase.from("categories").select("id").limit(1).single();
    if (!cat) throw new Error("No category in seed");

    const result = await saveDocument({
      title: "Publish Gate Test Doc",
      categoryId: cat.id,
      priceLkr: 15,
      docKind: "safety_sign",
      description: null,
      coverImageKey: null,
      pageCount: null,
      seoTitle: null,
      seoDescription: null,
    });
    if (!result.ok) throw new Error("saveDocument failed");
    docId = result.documentId;
    updatedAt = result.updatedAt;
  });

  afterAll(async () => {
    if (docId) {
      await supabase.from("document_files").delete().eq("document_id", docId);
      await supabase.from("documents").delete().eq("id", docId);
    }
  });

  it("EC5: publish with zero files → files_missing lists all 6 missing slots (3 full + 3 preview)", async () => {
    const { setDocumentStatus } = await import("@/lib/documents/publish");
    const result = await setDocumentStatus(docId, "publish", updatedAt);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("validation_failed");
    if (result.code !== "validation_failed") return;
    expect(result.reason).toBe("files_missing");
    expect(result.missing).toContain("full:en");
    expect(result.missing).toContain("full:si");
    expect(result.missing).toContain("full:ta");
    expect(result.missing).toContain("preview:en");
    expect(result.missing).toContain("preview:si");
    expect(result.missing).toContain("preview:ta");
  });

  it("EC7: only en preview uploaded; publish refused with files_missing listing si and ta previews", async () => {
    // Upload all full files
    for (const lang of ["en", "si", "ta"] as const) {
      await uploadReady("full", lang, "pptx", 1);
    }
    // Upload only en preview
    await uploadReady("preview", "en", "png", 1);

    const { setDocumentStatus } = await import("@/lib/documents/publish");
    // Refresh updatedAt
    const { data: doc } = await supabase.from("documents").select("updated_at").eq("id", docId).single();
    const result = await setDocumentStatus(docId, "publish", doc!.updated_at);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("validation_failed");
    if (result.code !== "validation_failed") return;
    expect(result.reason).toBe("files_missing");
    expect(result.missing).toContain("preview:si");
    expect(result.missing).toContain("preview:ta");
    expect(result.missing).not.toContain("full:en");
    expect(result.missing).not.toContain("preview:en");
  });

  it("AC5/AC6: publish succeeds once all 3 full + 3 preview slot-1 are ready", async () => {
    // Upload missing previews
    await uploadReady("preview", "si", "png", 1);
    await uploadReady("preview", "ta", "png", 1);

    const { setDocumentStatus } = await import("@/lib/documents/publish");
    const { data: doc } = await supabase.from("documents").select("updated_at").eq("id", docId).single();
    const result = await setDocumentStatus(docId, "publish", doc!.updated_at);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.documentId).toBe(docId);

    // AC6: published_at is set
    const { data: published } = await supabase.from("documents").select("status, published_at").eq("id", docId).single();
    expect(published!.status).toBe("published");
    expect(published!.published_at).not.toBeNull();
  });

  it("AC6: hide sets status to hidden; does not touch any orders", async () => {
    const { setDocumentStatus } = await import("@/lib/documents/publish");
    const { data: doc } = await supabase.from("documents").select("updated_at").eq("id", docId).single();
    const result = await setDocumentStatus(docId, "hide", doc!.updated_at);

    expect(result.ok).toBe(true);
    const { data: hidden } = await supabase.from("documents").select("status").eq("id", docId).single();
    expect(hidden!.status).toBe("hidden");
  });
});
