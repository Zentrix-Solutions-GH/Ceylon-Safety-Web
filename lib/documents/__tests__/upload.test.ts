// S-070 AC1, AC2: startDocumentFileUpload — key paths, language/kind/sortOrder validation.
// Unit tests only; no DB, R2 mocked.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({
  serverConfig: { supabaseServiceRoleKey: "srk" },
  publicConfig: { supabaseUrl: "https://test.supabase.co", supabaseAnonKey: "anon" },
  r2Config: vi.fn(() => ({
    accountId: "acct",
    accessKeyId: "ak",
    secretAccessKey: "sk",
    bucketPublic: "pub",
    bucketPrivate: "priv",
    publicMediaBaseUrl: "https://cdn.test",
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

import { startDocumentFileUpload } from "@/lib/documents/upload";
import { requireStaff } from "@/lib/auth/server";
import { checkAdminWriteLimit } from "@/lib/ratelimit/index";
import { presignedPut } from "@/lib/r2/storage";

const mockPresignedPut = vi.mocked(presignedPut);

const DOC_ID = "11111111-1111-4111-8111-111111111111";
const FILE_ID = "22222222-2222-4222-8222-222222222222";
const UPLOAD_URL = "https://r2.test/presigned-put-url";

function chainedEq(finalValue: unknown) {
  // Returns a mock that handles arbitrarily deep .eq() chains
  const eq: ReturnType<typeof vi.fn> = vi.fn();
  const chain = {
    eq,
    order: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) }),
    single: vi.fn().mockResolvedValue(finalValue),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  eq.mockReturnValue(chain);
  return chain;
}

function mockInsert(fileId: string) {
  const docChain = chainedEq({ data: { id: DOC_ID }, error: null });
  docChain.single.mockResolvedValue({ data: { id: DOC_ID }, error: null });

  const versionChain = {
    eq: vi.fn(),
    order: vi.fn().mockReturnValue({
      limit: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    }),
  };
  // Chain all .eq() calls back to itself for the version lookup
  versionChain.eq.mockReturnValue(versionChain);

  let callCount = 0;
  mockFrom.mockImplementation((table: string) => {
    if (table === "documents") {
      // .eq("id", ...).is("deleted_at", null).single()
      const inner = { single: vi.fn().mockResolvedValue({ data: { id: DOC_ID }, error: null }) };
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ is: vi.fn().mockReturnValue(inner) }) }) };
    }
    if (table === "document_files") {
      callCount++;
      if (callCount === 1) {
        // version lookup
        return { select: vi.fn().mockReturnValue(versionChain) };
      }
      // insert
      return {
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: fileId }, error: null }),
          }),
        }),
      };
    }
    return {};
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPresignedPut.mockResolvedValue(UPLOAD_URL);
  mockInsert(FILE_ID);
});

describe("startDocumentFileUpload — AC1 happy path", () => {
  it("full file: returns upload URL and creates pending row with correct key path", async () => {
    const result = await startDocumentFileUpload({
      documentId: DOC_ID,
      kind: "full",
      language: "en",
      sortOrder: 1,
      format: "pptx",
      sizeBytes: 5_000_000,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.upload.uploadUrl).toBe(UPLOAD_URL);
    expect(result.upload.fileId).toBe(FILE_ID);
    // presignedPut called with private bucket and correct key prefix
    const [bucket, key] = mockPresignedPut.mock.calls[0];
    expect(bucket).toBe("priv");
    expect(key).toMatch(/^documents\/11111111-1111-4111-8111-111111111111\/en\/v\d+\//);
  });

  it("preview file (jpg): key path uses previews/ prefix with language and sort_order", async () => {
    const result = await startDocumentFileUpload({
      documentId: DOC_ID,
      kind: "preview",
      language: "si",
      sortOrder: 2,
      format: "jpg",
      sizeBytes: 500_000,
    });
    expect(result.ok).toBe(true);
    const [bucket, key] = mockPresignedPut.mock.calls[0];
    expect(bucket).toBe("priv");
    expect(key).toMatch(/^previews\/11111111-1111-4111-8111-111111111111\/si\/2\//);
    expect(key).toMatch(/\.jpg$/);
  });

  it("preview sort_order 3 (pdf): key path is correct", async () => {
    const result = await startDocumentFileUpload({
      documentId: DOC_ID,
      kind: "preview",
      language: "ta",
      sortOrder: 3,
      format: "pdf",
      sizeBytes: 500_000,
    });
    expect(result.ok).toBe(true);
    const [, key] = mockPresignedPut.mock.calls[0];
    expect(key).toMatch(/^previews\/[^/]+\/ta\/3\//);
    expect(key).toMatch(/\.pdf$/);
  });
});

describe("startDocumentFileUpload — AC2 validation", () => {
  it("invalid language returns validation_failed file_type", async () => {
    const result = await startDocumentFileUpload({
      documentId: DOC_ID,
      kind: "full",
      // @ts-expect-error intentional invalid value
      language: "fr",
      sortOrder: 1,
      format: "pptx",
      sizeBytes: 1000,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("validation_failed");
    if (result.code !== "validation_failed") return;
    expect(result.reason).toBe("file_type");
  });

  it("invalid kind returns validation_failed file_type", async () => {
    const result = await startDocumentFileUpload({
      documentId: DOC_ID,
      // @ts-expect-error intentional invalid value
      kind: "thumbnail",
      language: "en",
      sortOrder: 1,
      format: "pptx",
      sizeBytes: 1000,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("validation_failed");
    if (result.code !== "validation_failed") return;
    expect(result.reason).toBe("file_type");
  });

  it("full file with sort_order != 1 returns validation_failed file_type", async () => {
    const result = await startDocumentFileUpload({
      documentId: DOC_ID,
      kind: "full",
      language: "en",
      sortOrder: 2,
      format: "pptx",
      sizeBytes: 1000,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("validation_failed");
    if (result.code !== "validation_failed") return;
    expect(result.reason).toBe("file_type");
  });

  it("preview sort_order 0 returns validation_failed file_type", async () => {
    const result = await startDocumentFileUpload({
      documentId: DOC_ID,
      kind: "preview",
      language: "en",
      sortOrder: 0,
      format: "png",
      sizeBytes: 1000,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("validation_failed");
    if (result.code !== "validation_failed") return;
    expect(result.reason).toBe("file_type");
  });

  it("preview sort_order 4 returns validation_failed file_type", async () => {
    const result = await startDocumentFileUpload({
      documentId: DOC_ID,
      kind: "preview",
      language: "en",
      sortOrder: 4,
      format: "png",
      sizeBytes: 1000,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("validation_failed");
    if (result.code !== "validation_failed") return;
    expect(result.reason).toBe("file_type");
  });

  it("preview with invalid format returns validation_failed file_type", async () => {
    const result = await startDocumentFileUpload({
      documentId: DOC_ID,
      kind: "preview",
      language: "en",
      sortOrder: 1,
      format: "gif",
      sizeBytes: 1000,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("validation_failed");
    if (result.code !== "validation_failed") return;
    expect(result.reason).toBe("file_type");
  });
});

describe("EC1 — retry when pending row exists for the same slot", () => {
  it("startDocumentFileUpload succeeds and uses version 2 when a pending row already occupies version 1", async () => {
    // version lookup returns existing pending row at version 1
    const versionChain = {
      eq: vi.fn(),
      order: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: { version: 1 }, error: null }),
        }),
      }),
    };
    versionChain.eq.mockReturnValue(versionChain);

    let callCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "documents") {
        const inner = { single: vi.fn().mockResolvedValue({ data: { id: DOC_ID }, error: null }) };
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ is: vi.fn().mockReturnValue(inner) }) }) };
      }
      if (table === "document_files") {
        callCount++;
        if (callCount === 1) return { select: vi.fn().mockReturnValue(versionChain) };
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: FILE_ID }, error: null }),
            }),
          }),
        };
      }
      return {};
    });

    const result = await startDocumentFileUpload({
      documentId: DOC_ID, kind: "full", language: "en", sortOrder: 1, format: "pptx", sizeBytes: 5_000_000,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // key path should be v2 (next version after existing v1)
    const [, key] = mockPresignedPut.mock.calls[0];
    expect(key).toMatch(/\/v2\//);
  });
});

describe("startDocumentFileUpload — permission / rate limit", () => {
  it("not_allowed when requireStaff returns not_allowed", async () => {
    vi.mocked(requireStaff).mockResolvedValueOnce({ ok: false, code: "not_allowed" });
    const result = await startDocumentFileUpload({
      documentId: DOC_ID, kind: "full", language: "en", sortOrder: 1, format: "pptx", sizeBytes: 1000,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("not_allowed");
  });

  it("rate_limited when checkAdminWriteLimit returns not ok", async () => {
    vi.mocked(checkAdminWriteLimit).mockResolvedValueOnce({ ok: false, reason: "rate_limited" });
    const result = await startDocumentFileUpload({
      documentId: DOC_ID, kind: "full", language: "en", sortOrder: 1, format: "pptx", sizeBytes: 1000,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("rate_limited");
  });

  it("not_found when document does not exist", async () => {
    const inner = { single: vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } }) };
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ is: vi.fn().mockReturnValue(inner) }) }),
    }));
    const result = await startDocumentFileUpload({
      documentId: DOC_ID, kind: "full", language: "en", sortOrder: 1, format: "pptx", sizeBytes: 1000,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("not_found");
  });

  it("not_found when document is soft-deleted (deleted_at IS NOT NULL)", async () => {
    // .is("deleted_at", null) returns no row for a soft-deleted document
    const inner = { single: vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } }) };
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ is: vi.fn().mockReturnValue(inner) }) }),
    }));
    const result = await startDocumentFileUpload({
      documentId: DOC_ID, kind: "full", language: "en", sortOrder: 1, format: "pptx", sizeBytes: 1000,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("not_found");
  });

  it("upload_failed when presignedPut throws (R2 unavailable)", async () => {
    mockPresignedPut.mockRejectedValueOnce(new Error("R2 network error"));
    // Insert succeeds, presignedPut throws — pending row should be cleaned up
    const mockDelete = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    const origImpl = mockFrom.getMockImplementation();
    mockFrom.mockImplementation((table: string) => {
      if (table === "document_files") {
        const base = origImpl ? origImpl(table) : {};
        return { ...base, delete: mockDelete };
      }
      return origImpl ? origImpl(table) : {};
    });
    const result = await startDocumentFileUpload({
      documentId: DOC_ID, kind: "full", language: "en", sortOrder: 1, format: "pptx", sizeBytes: 5_000_000,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("upload_failed");
    expect(mockDelete).toHaveBeenCalled();
  });
});
