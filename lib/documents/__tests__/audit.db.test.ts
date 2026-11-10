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
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: DOC_ID }, error: null }),
          }),
        }),
      };
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
    expect(call.after.status).toBe("pending");
    expect(call.after.documentId).toBe(DOC_ID);
    expect(call.after.kind).toBe("full");
    expect(call.after.language).toBe("en");
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
    expect(call.after.status).toBe("ready");
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
