// S-070 AC9: no file key, no signed link in any response from startDocumentFileUpload
// or completeDocumentFileUpload (other than the upload URL itself in startDocumentFileUpload).

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

vi.mock("@/lib/ratelimit/index", () => ({
  checkAdminWriteLimit: vi.fn().mockResolvedValue({ ok: true }),
}));

import { startDocumentFileUpload, completeDocumentFileUpload } from "@/lib/documents/upload";
import { presignedPut, headObject, getObjectBytes } from "@/lib/r2/storage";

const mockPresignedPut = vi.mocked(presignedPut);
const mockHeadObject = vi.mocked(headObject);
const mockGetObjectBytes = vi.mocked(getObjectBytes);

const DOC_ID = "11111111-1111-4111-8111-111111111111";
const FILE_ID = "22222222-2222-4222-8222-222222222222";
const FILE_KEY = "documents/11111111-1111-4111-8111-111111111111/en/v1/secret.pptx";

function makeDeepEq(resolvedValue: unknown) {
  const eqFn: ReturnType<typeof vi.fn> = vi.fn();
  const chain: Record<string, unknown> = {
    eq: eqFn,
    neq: vi.fn().mockResolvedValue({ error: null }),
    single: vi.fn().mockResolvedValue(resolvedValue),
  };
  eqFn.mockReturnValue(chain);
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPresignedPut.mockResolvedValue("https://r2.test/presigned");
  mockHeadObject.mockResolvedValue({ contentLength: 5_000_000 });
  mockGetObjectBytes.mockResolvedValue(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]));

  const rowData = {
    id: FILE_ID, document_id: DOC_ID, kind: "full", language: "en",
    sort_order: 1, format: "pptx", file_key: FILE_KEY,
    status: "pending", is_current: true, version: 1,
  };

  const versionChain = { eq: vi.fn(), order: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null }) }) }) };
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
    // document_files: return a mock that handles select (with chained eq) + insert + update
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
      update: vi.fn().mockReturnValue(makeDeepEq({ error: null })),
    };
  });
});

function containsFileKey(value: unknown, key: string): boolean {
  const str = JSON.stringify(value);
  return str.includes(key);
}

describe("AC9 — no file key leaks", () => {
  it("startDocumentFileUpload response does not contain the R2 file key", async () => {
    const result = await startDocumentFileUpload({
      documentId: DOC_ID, kind: "full", language: "en", sortOrder: 1, format: "pptx", sizeBytes: 5_000_000,
    });
    expect(containsFileKey(result, FILE_KEY)).toBe(false);
    // The upload URL is intentionally returned (it is the presigned PUT link)
    if (result.ok) {
      expect(result.upload.uploadUrl).toBe("https://r2.test/presigned");
    }
  });

  it("completeDocumentFileUpload success response does not contain the R2 file key", async () => {
    const result = await completeDocumentFileUpload(FILE_ID);
    expect(containsFileKey(result, FILE_KEY)).toBe(false);
  });

  it("completeDocumentFileUpload error response does not contain the R2 file key", async () => {
    mockHeadObject.mockResolvedValueOnce(null); // EC10 — object absent
    const result = await completeDocumentFileUpload(FILE_ID);
    expect(result.ok).toBe(false);
    expect(containsFileKey(result, FILE_KEY)).toBe(false);
  });
});
