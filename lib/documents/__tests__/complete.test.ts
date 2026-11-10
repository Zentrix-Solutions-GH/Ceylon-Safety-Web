// S-070 AC3, EC2, EC8, EC9, EC10, EC11: completeDocumentFileUpload — real-type check,
// size, checksum, role re-check. Unit tests with R2 mock.

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
  presignedPut: vi.fn(),
  headObject: vi.fn(),
  getObjectBytes: vi.fn(),
  deleteObject: vi.fn(),
}));

const mockFrom = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: vi.fn(() => ({ from: mockFrom })),
}));

vi.mock("@/lib/auth/server", () => ({
  requireStaff: vi.fn().mockResolvedValue({
    ok: true,
    user: { id: "actor-uuid-0001", claimedRole: "admin" },
  }),
}));

vi.mock("@/lib/audit/index", () => ({
  writeAuditRow: vi.fn().mockResolvedValue(undefined),
  writeDenied: vi.fn().mockResolvedValue(undefined),
}));

import { completeDocumentFileUpload } from "@/lib/documents/upload";
import { requireStaff } from "@/lib/auth/server";
import { headObject, getObjectBytes, deleteObject } from "@/lib/r2/storage";

const mockHeadObject = vi.mocked(headObject);
const mockGetObjectBytes = vi.mocked(getObjectBytes);
const mockDeleteObject = vi.mocked(deleteObject);

// Magic bytes
const PPTX_MAGIC = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00]);
const PDF_MAGIC  = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x00]);
const PNG_MAGIC  = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPG_MAGIC  = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
const EXE_MAGIC  = new Uint8Array([0x4d, 0x5a, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);

const FILE_ID = "33333333-3333-4333-8333-333333333333";
const KEY = "documents/doc1/en/v1/file.pptx";

function makeEqChain(resolvedValue: unknown) {
  const eqFn: ReturnType<typeof vi.fn> = vi.fn();
  const chain: Record<string, unknown> = {
    eq: eqFn,
    neq: vi.fn().mockResolvedValue({ error: null }),
    single: vi.fn().mockResolvedValue(resolvedValue),
  };
  eqFn.mockReturnValue(chain);
  return chain;
}

function setupPendingRow(kind: "full" | "preview", format: string, key: string = KEY) {
  const rowData = {
    id: FILE_ID, document_id: "doc1", kind, language: "en",
    sort_order: 1, format, file_key: key, status: "pending", is_current: true, version: 1,
  };
  mockFrom.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: rowData, error: null }),
      }),
    }),
    update: vi.fn().mockReturnValue(makeEqChain({ error: null })),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("completeDocumentFileUpload — AC3 real-type check", () => {
  it("full/pptx: accepts ZIP magic bytes, marks ready", async () => {
    setupPendingRow("full", "pptx");
    mockHeadObject.mockResolvedValue({ contentLength: 5_000_000 });
    mockGetObjectBytes.mockResolvedValue(PPTX_MAGIC);

    const result = await completeDocumentFileUpload(FILE_ID);
    expect(result.ok).toBe(true);
  });

  it("preview/pdf: accepts %PDF magic bytes, marks ready", async () => {
    setupPendingRow("preview", "pdf", "previews/doc1/en/1/prev.pdf");
    mockHeadObject.mockResolvedValue({ contentLength: 2_000_000 });
    mockGetObjectBytes.mockResolvedValue(PDF_MAGIC);

    const result = await completeDocumentFileUpload(FILE_ID);
    expect(result.ok).toBe(true);
  });

  it("preview/png: accepts PNG magic bytes", async () => {
    setupPendingRow("preview", "png", "previews/doc1/en/1/prev.png");
    mockHeadObject.mockResolvedValue({ contentLength: 500_000 });
    mockGetObjectBytes.mockResolvedValue(PNG_MAGIC);

    const result = await completeDocumentFileUpload(FILE_ID);
    expect(result.ok).toBe(true);
  });

  it("preview/jpg: accepts FF D8 magic bytes", async () => {
    setupPendingRow("preview", "jpg", "previews/doc1/en/1/prev.jpg");
    mockHeadObject.mockResolvedValue({ contentLength: 500_000 });
    mockGetObjectBytes.mockResolvedValue(JPG_MAGIC);

    const result = await completeDocumentFileUpload(FILE_ID);
    expect(result.ok).toBe(true);
  });

  it("EC2: .exe renamed to .pptx — real-type check rejects, marks upload_failed, deletes object", async () => {
    setupPendingRow("full", "pptx");
    mockHeadObject.mockResolvedValue({ contentLength: 5_000_000 });
    mockGetObjectBytes.mockResolvedValue(EXE_MAGIC);

    const result = await completeDocumentFileUpload(FILE_ID);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("validation_failed");
    if (result.code !== "validation_failed") return;
    expect(result.reason).toBe("file_type");
    expect(mockDeleteObject).toHaveBeenCalled();
  });
});

describe("completeDocumentFileUpload — EC8 size", () => {
  it("zero-byte file is rejected with file_too_large (edge: empty)", async () => {
    setupPendingRow("full", "pptx");
    mockHeadObject.mockResolvedValue({ contentLength: 0 });
    mockGetObjectBytes.mockResolvedValue(PPTX_MAGIC);

    const result = await completeDocumentFileUpload(FILE_ID);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("validation_failed");
    if (result.code !== "validation_failed") return;
    expect(result.reason).toBe("file_too_large");
  });

  it("file just over pptx limit is rejected with file_too_large", async () => {
    setupPendingRow("full", "pptx");
    mockHeadObject.mockResolvedValue({ contentLength: 100 * 1024 * 1024 + 1 });
    mockGetObjectBytes.mockResolvedValue(PPTX_MAGIC);

    const result = await completeDocumentFileUpload(FILE_ID);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("validation_failed");
    if (result.code !== "validation_failed") return;
    expect(result.reason).toBe("file_too_large");
    expect(mockDeleteObject).toHaveBeenCalled();
  });

  it("preview file just over preview limit is rejected", async () => {
    setupPendingRow("preview", "png", "previews/doc1/en/1/prev.png");
    mockHeadObject.mockResolvedValue({ contentLength: 10 * 1024 * 1024 + 1 });
    mockGetObjectBytes.mockResolvedValue(PNG_MAGIC);

    const result = await completeDocumentFileUpload(FILE_ID);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("validation_failed");
    if (result.code !== "validation_failed") return;
    expect(result.reason).toBe("file_too_large");
  });
});

describe("completeDocumentFileUpload — EC9, EC10, EC11", () => {
  it("EC9: role removed mid-upload returns not_allowed", async () => {
    vi.mocked(requireStaff).mockResolvedValueOnce({ ok: false, code: "not_allowed" });
    const result = await completeDocumentFileUpload(FILE_ID);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("not_allowed");
  });

  it("EC10: R2 object absent (headObject returns null) → upload_failed", async () => {
    setupPendingRow("full", "pptx");
    mockHeadObject.mockResolvedValue(null);

    const result = await completeDocumentFileUpload(FILE_ID);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("upload_failed");
  });

  it("EC11: row already ready → upload_failed, no duplicate version", async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: FILE_ID, document_id: "doc1", kind: "full", language: "en",
              sort_order: 1, format: "pptx", file_key: KEY,
              status: "ready", is_current: true, version: 1,
            },
            error: null,
          }),
        }),
      }),
      update: vi.fn().mockReturnValue(makeEqChain({ error: null })),
    });

    const result = await completeDocumentFileUpload(FILE_ID);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("upload_failed");
  });
});
