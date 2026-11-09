// AC12: list and detail responses must never expose a file key.
// Unit tests — no DB needed; validates the response shape mapper.

import { describe, it, expect, vi } from "vitest";

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
import { mapDocumentRow, mapDocumentDetail } from "@/lib/admin/actions/documents";

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
