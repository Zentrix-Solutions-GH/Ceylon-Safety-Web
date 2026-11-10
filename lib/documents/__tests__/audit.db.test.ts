// S-070 AC8: writeAuditRow is called for file_upload start and complete, and for publish/hide.
// Unit-level: mocks Supabase but asserts the writeAuditRow mock was called with the right args.
// No real Supabase needed — env gate kept for consistency.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({
  serverConfig: { supabaseServiceRoleKey: "srk" },
  publicConfig: { supabaseUrl: "https://test.supabase.co", supabaseAnonKey: "anon" },
  r2Config: vi.fn(() => ({
    accountId: "acct", accessKeyId: "ak", secretAccessKey: "sk",
    bucketPublic: "pub", bucketPrivate: "priv", publicMediaBaseUrl: "https://cdn.test",
  })),
  PPTX_MAX_BYTES: 100 * 1024 * 1024,
  PREVIEW_MAX_BYTES: 10 * 1024 * 1024,
}));

vi.mock("@/lib/r2/storage", () => ({
  presignedPut: vi.fn().mockResolvedValue("https://r2.test/put"),
  headObject: vi.fn().mockResolvedValue({ contentLength: 5_000_000 }),
  getObjectBytes: vi.fn().mockResolvedValue(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0])),
  deleteObject: vi.fn(),
}));

vi.mock("@/lib/audit/index", () => ({
  writeAuditRow: vi.fn().mockResolvedValue(undefined),
  writeDenied:   vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/ratelimit/index", () => ({
  checkAdminWriteLimit: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("@/lib/cache/purge", () => ({
  purgeDocument: vi.fn().mockResolvedValue({ ok: true }),
}));

const mockFrom = vi.fn();
const mockRpc  = vi.fn().mockResolvedValue({ error: null });
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: vi.fn(() => ({ from: mockFrom, rpc: mockRpc })),
}));

vi.mock("@/lib/auth/server", () => ({
  requireStaff: vi.fn().mockResolvedValue({
    ok: true,
    user: { id: "actor-uuid-audit", claimedRole: "admin", email: "admin@dev.invalid" },
  }),
}));

import { startDocumentFileUpload, completeDocumentFileUpload } from "@/lib/documents/upload";
import { setDocumentStatus } from "@/lib/documents/publish";
import { writeAuditRow } from "@/lib/audit/index";
const mockWriteAuditRow = vi.mocked(writeAuditRow);

const DOC_ID  = "aaaa0001-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const FILE_ID = "bbbb0001-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const FILE_KEY = "documents/aaaa0001-aaaa-4aaa-8aaa-aaaaaaaaaaaa/en/v1/file.pptx";

function setupMocks() {
  const rowData = {
    id: FILE_ID, document_id: DOC_ID, kind: "full", language: "en",
    sort_order: 1, format: "pptx", file_key: FILE_KEY,
    status: "pending", is_current: false, version: 1,
  };
  const versionChain = {
    eq: vi.fn(),
    order: vi.fn().mockReturnValue({
      limit: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: null }),
      }),
    }),
  };
  versionChain.eq.mockReturnValue(versionChain);

  mockFrom.mockImplementation((table: string) => {
    if (table === "documents") {
      // startDocumentFileUpload: .eq("id", ...).is("deleted_at", null).single()
      const inner = { single: vi.fn().mockResolvedValue({ data: { id: DOC_ID }, error: null }) };
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ is: vi.fn().mockReturnValue(inner) }) }) };
    }
    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          ...versionChain,
          single: vi.fn().mockResolvedValue({ data: rowData, error: null }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: FILE_ID }, error: null }),
        }),
      }),
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
    };
  });
}

const UPDATED_AT = "2026-11-10T10:00:00.000Z";

function setupPublishMocks(action: "publish" | "hide" = "publish") {
  // For publish we need: doc with price+category, ready full files x3, ready preview x3,
  // then an update, then article_refs lookup.
  const docRow = {
    id: DOC_ID, status: action === "publish" ? "draft" : "published",
    updated_at: UPDATED_AT, price_cents: 1500, category_id: "cat-1",
  };

  let docFilesCall = 0;
  mockFrom.mockImplementation((table: string) => {
    if (table === "documents") {
      // select chain: .eq(...).is(...).single()
      const selectInner = {
        single: vi.fn().mockResolvedValue({ data: docRow, error: null }),
      };
      const selectEq = { eq: vi.fn().mockReturnValue({ is: vi.fn().mockReturnValue(selectInner) }) };
      // update chain: .eq(...).eq(...).select(...).single()
      const updateSingle = { single: vi.fn().mockResolvedValue({ data: { updated_at: UPDATED_AT }, error: null }) };
      const updateSelect = { select: vi.fn().mockReturnValue(updateSingle) };
      const updateEq2 = { eq: vi.fn().mockReturnValue(updateSelect) };
      const updateEq1 = { eq: vi.fn().mockReturnValue(updateEq2) };
      return {
        select: vi.fn().mockReturnValue(selectEq),
        update: vi.fn().mockReturnValue(updateEq1),
      };
    }
    if (table === "document_files") {
      docFilesCall++;
      // first call: full files; second call: preview files
      const langs = docFilesCall === 1
        ? [{ language: "en" }, { language: "si" }, { language: "ta" }]
        : [{ language: "en" }, { language: "si" }, { language: "ta" }];
      const chain = { eq: vi.fn() };
      chain.eq.mockReturnValue({ ...chain, data: langs });
      // Supabase chained query: .eq().eq().eq().eq().eq() → resolves with { data }
      const terminal = { data: langs, error: null };
      const eqFn: ReturnType<typeof vi.fn> = vi.fn();
      const eqChain = { eq: eqFn };
      eqFn.mockReturnValue({ ...eqChain, ...terminal });
      return { select: vi.fn().mockReturnValue({ eq: eqFn }) };
    }
    if (table === "article_refs") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      };
    }
    return {};
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRpc.mockResolvedValue({ error: null });
  setupMocks();
});

describe("AC8 — audit log for file upload start", () => {
  it("startDocumentFileUpload writes audit row with action=document.file_upload and status=pending", async () => {
    await startDocumentFileUpload({
      documentId: DOC_ID, kind: "full", language: "en", sortOrder: 1, format: "pptx", sizeBytes: 5_000_000,
    });
    expect(mockWriteAuditRow).toHaveBeenCalledOnce();
    const call = mockWriteAuditRow.mock.calls[0][0];
    expect(call.action).toBe("document.file_upload");
    expect(call.actorId).toBe("actor-uuid-audit");
    expect(call.entityType).toBe("document_files");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const after = call.after as any;
    expect(after.status).toBe("pending");
    expect(after.documentId).toBe(DOC_ID);
    expect(after.kind).toBe("full");
    expect(after.language).toBe("en");
  });
});

describe("AC8 — audit log for file upload complete", () => {
  it("completeDocumentFileUpload writes audit row with action=document.file_upload and status=ready", async () => {
    await completeDocumentFileUpload(FILE_ID);
    expect(mockWriteAuditRow).toHaveBeenCalledOnce();
    const call = mockWriteAuditRow.mock.calls[0][0];
    expect(call.action).toBe("document.file_upload");
    expect(call.actorId).toBe("actor-uuid-audit");
    expect(call.entityType).toBe("document_files");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((call.after as any).status).toBe("ready");
  });
});

describe("AC8 — no audit row on failure paths", () => {
  it("completeDocumentFileUpload does NOT write audit when R2 object is absent", async () => {
    const { headObject } = await import("@/lib/r2/storage");
    vi.mocked(headObject).mockResolvedValueOnce(null);
    await completeDocumentFileUpload(FILE_ID);
    expect(mockWriteAuditRow).not.toHaveBeenCalled();
  });

  it("completeDocumentFileUpload does NOT write audit when magic bytes fail", async () => {
    const { getObjectBytes } = await import("@/lib/r2/storage");
    vi.mocked(getObjectBytes).mockResolvedValueOnce(new Uint8Array([0x4d, 0x5a, 0, 0, 0, 0, 0, 0])); // EXE
    await completeDocumentFileUpload(FILE_ID);
    expect(mockWriteAuditRow).not.toHaveBeenCalled();
  });
});

describe("AC8 — audit log for publish", () => {
  it("setDocumentStatus(publish) writes audit row with action=document.publish", async () => {
    setupPublishMocks("publish");
    const result = await setDocumentStatus(DOC_ID, "publish", UPDATED_AT);
    expect(result.ok).toBe(true);
    expect(mockWriteAuditRow).toHaveBeenCalledOnce();
    const call = mockWriteAuditRow.mock.calls[0][0];
    expect(call.action).toBe("document.publish");
    expect(call.actorId).toBe("actor-uuid-audit");
    expect(call.entityType).toBe("documents");
    expect(call.entityId).toBe(DOC_ID);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((call.after as any).status).toBe("published");
  });
});

describe("AC8 — audit log for hide", () => {
  it("setDocumentStatus(hide) writes audit row with action=document.hide", async () => {
    setupPublishMocks("hide");
    const result = await setDocumentStatus(DOC_ID, "hide", UPDATED_AT);
    expect(result.ok).toBe(true);
    expect(mockWriteAuditRow).toHaveBeenCalledOnce();
    const call = mockWriteAuditRow.mock.calls[0][0];
    expect(call.action).toBe("document.hide");
    expect(call.actorId).toBe("actor-uuid-audit");
    expect(call.entityType).toBe("documents");
    expect(call.entityId).toBe(DOC_ID);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((call.after as any).status).toBe("hidden");
  });
});

describe("EC6 — hide allowed even when article_refs exist", () => {
  it("setDocumentStatus(hide) succeeds when document is referenced by articles", async () => {
    // article_refs returns two article IDs
    const docRow = {
      id: DOC_ID, status: "published",
      updated_at: UPDATED_AT, price_cents: 1500, category_id: "cat-1",
    };
    mockFrom.mockImplementation((table: string) => {
      if (table === "documents") {
        const selectInner = { single: vi.fn().mockResolvedValue({ data: docRow, error: null }) };
        const selectEq = { eq: vi.fn().mockReturnValue({ is: vi.fn().mockReturnValue(selectInner) }) };
        const updateSingle = { single: vi.fn().mockResolvedValue({ data: { updated_at: UPDATED_AT }, error: null }) };
        const updateSelect = { select: vi.fn().mockReturnValue(updateSingle) };
        const updateEq2 = { eq: vi.fn().mockReturnValue(updateSelect) };
        const updateEq1 = { eq: vi.fn().mockReturnValue(updateEq2) };
        return {
          select: vi.fn().mockReturnValue(selectEq),
          update: vi.fn().mockReturnValue(updateEq1),
        };
      }
      if (table === "article_refs") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{ article_id: "art-1" }, { article_id: "art-2" }],
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    });

    const result = await setDocumentStatus(DOC_ID, "hide", UPDATED_AT);
    expect(result.ok).toBe(true);
    // hide has no file condition — succeeds regardless of article refs
  });
});

describe("P1 — TOCTOU: concurrent publish returns version_conflict", () => {
  it("setDocumentStatus returns version_conflict when UPDATE matches 0 rows (PGRST116)", async () => {
    // Simulate the race: doc fetched ok, but UPDATE finds 0 rows (another request won)
    const docRow = {
      id: DOC_ID, status: "draft",
      updated_at: UPDATED_AT, price_cents: 1500, category_id: "cat-1",
    };
    // We need a mock where publish path skips file checks (only for hide)
    // Use hide to avoid the full-file and preview checks
    const selectInner = { single: vi.fn().mockResolvedValue({ data: docRow, error: null }) };
    const selectEq = { eq: vi.fn().mockReturnValue({ is: vi.fn().mockReturnValue(selectInner) }) };
    // UPDATE returns PGRST116 (zero rows matched)
    const updateSingle = {
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { code: "PGRST116", message: "0 rows" },
      }),
    };
    const updateSelect = { select: vi.fn().mockReturnValue(updateSingle) };
    const updateEq2 = { eq: vi.fn().mockReturnValue(updateSelect) };
    const updateEq1 = { eq: vi.fn().mockReturnValue(updateEq2) };
    mockFrom.mockImplementation((table: string) => {
      if (table === "documents") return { select: vi.fn().mockReturnValue(selectEq), update: vi.fn().mockReturnValue(updateEq1) };
      return {};
    });

    const result = await setDocumentStatus(DOC_ID, "hide", UPDATED_AT);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("version_conflict");
  });
});

describe("AC7 — purge warning surfaced when purgeDocument fails", () => {
  it("setDocumentStatus returns purgeWarning when purgeDocument returns ok:false", async () => {
    const { purgeDocument } = await import("@/lib/cache/purge");
    vi.mocked(purgeDocument).mockResolvedValueOnce({ ok: false, code: "purge_failed" });

    setupPublishMocks("hide");
    const result = await setDocumentStatus(DOC_ID, "hide", UPDATED_AT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.purgeWarning).toBe(
      "The change is saved but the site may show the old page for a few minutes."
    );
  });

  it("setDocumentStatus returns no purgeWarning when purgeDocument succeeds", async () => {
    const { purgeDocument } = await import("@/lib/cache/purge");
    vi.mocked(purgeDocument).mockResolvedValueOnce({ ok: true });

    setupPublishMocks("publish");
    const result = await setDocumentStatus(DOC_ID, "publish", UPDATED_AT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.purgeWarning).toBeUndefined();
  });
});
