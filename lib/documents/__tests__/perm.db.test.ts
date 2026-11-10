// S-070 AC7: permission enforcement on startDocumentFileUpload and completeDocumentFileUpload.
// - admin and maintainer with documents.* → allowed
// - customer (no staff role) → not_allowed
// - unauthenticated → not_allowed
// Unit test: requireStaff mock controls the outcome.

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

vi.mock("@/lib/auth/server", () => ({ requireStaff: vi.fn() }));

const mockFrom = vi.fn();
const mockRpc  = vi.fn().mockResolvedValue({ error: null });
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: vi.fn(() => ({ from: mockFrom, rpc: mockRpc })),
}));

import { startDocumentFileUpload, completeDocumentFileUpload } from "@/lib/documents/upload";
import { setDocumentStatus } from "@/lib/documents/publish";
import { requireStaff } from "@/lib/auth/server";
const mockRequireStaff = vi.mocked(requireStaff);

const DOC_ID  = "cccc0001-cccc-4ccc-8ccc-cccccccccccc";
const FILE_ID = "dddd0001-dddd-4ddd-8ddd-dddddddddddd";
const FILE_KEY = `documents/${DOC_ID}/en/v1/file.pptx`;

function setupAllowedMocks() {
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
      const docSingle = { single: vi.fn().mockResolvedValue({ data: { id: DOC_ID }, error: null }) };
      const docIs = { is: vi.fn().mockReturnValue(docSingle) };
      const docEq = { eq: vi.fn().mockReturnValue(docIs) };
      return { select: vi.fn().mockReturnValue(docEq) };
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
});

const adminUser = { id: "admin-id", email: "a@dev.invalid", claimedRole: "admin" as const, hasAuthenticatorLevel: true, hasTotpEnrolled: true };
const editorUser = { id: "editor-id", email: "e@dev.invalid", claimedRole: "editor" as const, hasAuthenticatorLevel: true, hasTotpEnrolled: true };

describe("AC7 — permission: admin allowed", () => {
  it("startDocumentFileUpload succeeds for admin", async () => {
    mockRequireStaff.mockResolvedValue({ ok: true, user: adminUser });
    setupAllowedMocks();
    const result = await startDocumentFileUpload({
      documentId: DOC_ID, kind: "full", language: "en", sortOrder: 1, format: "pptx", sizeBytes: 5_000_000,
    });
    expect(result.ok).toBe(true);
  });

  it("completeDocumentFileUpload succeeds for admin", async () => {
    mockRequireStaff.mockResolvedValue({ ok: true, user: adminUser });
    setupAllowedMocks();
    const result = await completeDocumentFileUpload(FILE_ID);
    expect(result.ok).toBe(true);
  });
});

describe("AC7 — permission: editor allowed", () => {
  it("startDocumentFileUpload succeeds for editor", async () => {
    mockRequireStaff.mockResolvedValue({ ok: true, user: editorUser });
    setupAllowedMocks();
    const result = await startDocumentFileUpload({
      documentId: DOC_ID, kind: "full", language: "en", sortOrder: 1, format: "pptx", sizeBytes: 5_000_000,
    });
    expect(result.ok).toBe(true);
  });
});

describe("AC7 — permission: customer refused", () => {
  it("startDocumentFileUpload returns not_allowed for a customer session", async () => {
    mockRequireStaff.mockResolvedValue({ ok: false, code: "not_allowed" });
    const result = await startDocumentFileUpload({
      documentId: DOC_ID, kind: "full", language: "en", sortOrder: 1, format: "pptx", sizeBytes: 5_000_000,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("not_allowed");
  });

  it("completeDocumentFileUpload returns not_allowed for a customer session", async () => {
    mockRequireStaff.mockResolvedValue({ ok: false, code: "not_allowed" });
    const result = await completeDocumentFileUpload(FILE_ID);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("not_allowed");
  });
});

describe("AC7 — permission: unauthenticated refused", () => {
  it("startDocumentFileUpload returns not_allowed when session is absent", async () => {
    mockRequireStaff.mockResolvedValue({ ok: false, code: "not_allowed" });
    const result = await startDocumentFileUpload({
      documentId: DOC_ID, kind: "full", language: "en", sortOrder: 1, format: "pptx", sizeBytes: 5_000_000,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("not_allowed");
  });
});

describe("S17 — suspended user blocked", () => {
  it("startDocumentFileUpload returns not_allowed for a suspended user", async () => {
    // requireStaff returns not_allowed when the user is suspended (handled centrally)
    mockRequireStaff.mockResolvedValue({ ok: false, code: "not_allowed" });
    const result = await startDocumentFileUpload({
      documentId: DOC_ID, kind: "full", language: "en", sortOrder: 1, format: "pptx", sizeBytes: 5_000_000,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("not_allowed");
  });

  it("completeDocumentFileUpload returns not_allowed for a suspended user", async () => {
    mockRequireStaff.mockResolvedValue({ ok: false, code: "not_allowed" });
    const result = await completeDocumentFileUpload(FILE_ID);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("not_allowed");
  });
});

describe("AC7 — permission: setDocumentStatus refused for non-staff", () => {
  it("setDocumentStatus returns not_allowed for a customer session", async () => {
    mockRequireStaff.mockResolvedValue({ ok: false, code: "not_allowed" });
    const result = await setDocumentStatus(DOC_ID, "publish", new Date().toISOString());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("not_allowed");
  });

  it("setDocumentStatus returns not_allowed for a suspended user", async () => {
    mockRequireStaff.mockResolvedValue({ ok: false, code: "not_allowed" });
    const result = await setDocumentStatus(DOC_ID, "hide", new Date().toISOString());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("not_allowed");
  });
});
