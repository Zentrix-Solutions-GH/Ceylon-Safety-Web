// AC12: list and detail responses must never expose a file key.
// Unit tests — no DB needed; validates the response shape mapper.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({
  serverConfig: { supabaseServiceRoleKey: "srk" },
  publicConfig: { supabaseUrl: "https://test.supabase.co", supabaseAnonKey: "anon" },
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
  createSupabaseServiceRoleClient: vi.fn(() => ({ from: vi.fn() })),
}));
vi.mock("@/lib/auth/server", () => ({
  requireStaff: vi.fn(),
}));
vi.mock("@/lib/audit/index", () => ({
  writeAuditRow: vi.fn(),
  writeDenied: vi.fn(),
}));
vi.mock("@/lib/ratelimit/index", () => ({
  checkAdminWriteLimit: vi.fn(),
}));
vi.mock("@/lib/auth/step-up", () => ({
  requireStepUp: vi.fn(),
  _resetCacheForTest: vi.fn(),
}));

// mapDocumentRow and mapDocumentDetail are pure mapping functions — no DB calls.
import { mapDocumentRow, mapDocumentDetail, listDocuments, getDocument } from "@/lib/admin/actions/documents";
import { requireStaff } from "@/lib/auth/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

const FILE_ROW_WITH_KEY = {
  id: "file-uuid",
  document_id: "doc-uuid",
  kind: "full",
  language: "en",
  status: "ready",
  file_key: "private/documents/doc-uuid/en/v1/file.pptx", // must NOT appear in output
  size_bytes: 123456,
  is_current: true,
};

const DOC_ROW = {
  id: "doc-uuid",
  title: "Safety Checklist",
  slug: "safety-checklist",
  doc_kind: "checklist",
  category_id: "cat-uuid",
  categories: { name: "General" },
  price_cents: 150000,
  status: "draft",
  page_count: null,
  preview_pages: 3,
  download_count: 0,
  purchase_count: 0,
  description: null,
  cover_image_key: null,
  seo_title: null,
  seo_description: null,
  published_at: null,
  updated_at: "2026-01-01T00:00:00Z",
  created_at: "2026-01-01T00:00:00Z",
  document_files: [FILE_ROW_WITH_KEY],
};

describe("mapDocumentRow — AC12 no file key in list row", () => {
  it("does not expose file_key in a list row", () => {
    const row = mapDocumentRow(DOC_ROW as Parameters<typeof mapDocumentRow>[0]);
    const json = JSON.stringify(row);
    expect(json).not.toContain("file_key");
    expect(json).not.toContain("private/documents");
  });

  it("includes expected fields in list row", () => {
    const row = mapDocumentRow(DOC_ROW as Parameters<typeof mapDocumentRow>[0]);
    expect(row).toHaveProperty("id", "doc-uuid");
    expect(row).toHaveProperty("title", "Safety Checklist");
    expect(row).toHaveProperty("priceCents", 150000);
    expect(row).toHaveProperty("languageSlots");
    expect(Array.isArray(row.languageSlots)).toBe(true);
  });

  it("maps en:full:ready to 'ready' in languageSlots", () => {
    const row = mapDocumentRow(DOC_ROW as Parameters<typeof mapDocumentRow>[0]);
    const en = row.languageSlots.find((s) => s.language === "en");
    expect(en?.full).toBe("ready");
  });

  it("maps missing language slot to 'missing'", () => {
    const row = mapDocumentRow(DOC_ROW as Parameters<typeof mapDocumentRow>[0]);
    const si = row.languageSlots.find((s) => s.language === "si");
    expect(si?.full).toBe("missing");
  });

  it("maps pending file to 'uploading'", () => {
    const rowWithPending = {
      ...DOC_ROW,
      document_files: [{ ...FILE_ROW_WITH_KEY, language: "ta", status: "pending", kind: "full" }],
    };
    const row = mapDocumentRow(rowWithPending as Parameters<typeof mapDocumentRow>[0]);
    const ta = row.languageSlots.find((s) => s.language === "ta");
    expect(ta?.full).toBe("uploading");
  });
});

describe("mapDocumentDetail — AC12 no file key in detail", () => {
  it("does not expose file_key in a detail record", () => {
    const doc = mapDocumentDetail(DOC_ROW as Parameters<typeof mapDocumentDetail>[0]);
    const json = JSON.stringify(doc);
    expect(json).not.toContain("file_key");
    expect(json).not.toContain("private/documents");
  });

  it("includes expected fields in detail", () => {
    const doc = mapDocumentDetail(DOC_ROW as Parameters<typeof mapDocumentDetail>[0]);
    expect(doc).toHaveProperty("id", "doc-uuid");
    expect(doc).toHaveProperty("description", null);
    expect(doc).toHaveProperty("previewPages", 3);
  });
});

describe("listDocuments / getDocument — AC12 no file key via public functions", () => {
  const DOC_ID_VALID = "aa010001-0000-4000-8000-000000000001";

  beforeEach(() => {
    vi.mocked(requireStaff).mockResolvedValue({
      ok: true,
      user: {
        id: "actor-uuid-0001",
        email: "admin@test.com",
        claimedRole: "admin",
        hasAuthenticatorLevel: true,
        hasTotpEnrolled: true,
      },
    } as never);
  });

  it("listDocuments response JSON never contains file_key", async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      textSearch: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({
        data: [{ ...DOC_ROW, id: DOC_ID_VALID }],
        error: null,
        count: 1,
      }),
    });
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue({ from: mockFrom } as never);

    const result = await listDocuments({});
    expect(result.ok).toBe(true);
    if (result.ok) {
      const json = JSON.stringify(result.rows);
      expect(json).not.toContain("file_key");
      expect(json).not.toContain("private/documents");
    }
  });

  it("getDocument response JSON never contains file_key", async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { ...DOC_ROW, id: DOC_ID_VALID },
        error: null,
      }),
    });
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue({ from: mockFrom } as never);

    const result = await getDocument(DOC_ID_VALID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const json = JSON.stringify(result.document);
      expect(json).not.toContain("file_key");
      expect(json).not.toContain("private/documents");
    }
  });
});
