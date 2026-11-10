// S-071 AC7: correct Next.js cache tags applied to public document reads,
// and correct TTL values wired into unstable_cache calls.

import { describe, it, expect, vi, beforeEach } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockUnstableCache = vi.fn((..._args: any[]) => _args[0]);
vi.mock("next/cache", () => ({ unstable_cache: mockUnstableCache, revalidateTag: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({
  serverConfig: { documentsPageSize: 12, previewRateLimitPerMinute: 60 },
  r2Config: () => null,
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAnonClient: vi.fn(),
  createSupabaseServiceRoleClient: vi.fn(),
}));
vi.mock("@/lib/auth/server", () => ({ requireStaff: vi.fn() }));
vi.mock("@/lib/ratelimit/index", () => ({ checkRateLimit: vi.fn() }));

import {
  DOCUMENTS_LIST_TAG,
  DOCUMENTS_NOT_FOUND_TAG,
  documentTag,
} from "@/lib/cache/tags";

describe("Cache tags (AC7)", () => {
  it("DOCUMENTS_LIST_TAG is defined", () => {
    expect(typeof DOCUMENTS_LIST_TAG).toBe("string");
    expect(DOCUMENTS_LIST_TAG.length).toBeGreaterThan(0);
  });

  it("DOCUMENTS_NOT_FOUND_TAG is a separate tag from DOCUMENTS_LIST_TAG", () => {
    expect(DOCUMENTS_NOT_FOUND_TAG).not.toBe(DOCUMENTS_LIST_TAG);
    expect(typeof DOCUMENTS_NOT_FOUND_TAG).toBe("string");
  });

  it("documentTag produces a per-document tag", () => {
    const tag = documentTag("abc123");
    expect(tag).toContain("abc123");
    expect(typeof tag).toBe("string");
  });

  it("documentTag is unique per id", () => {
    expect(documentTag("id-1")).not.toBe(documentTag("id-2"));
  });
});

describe("Cache window constants (AC7)", () => {
  it("list cache max-age is at most 60 seconds", async () => {
    // The public.ts module must export these constants for verification.
    const { LIST_CACHE_SECONDS, DOCUMENT_CACHE_SECONDS, NOT_FOUND_CACHE_SECONDS } =
      await import("@/lib/documents/public");
    expect(LIST_CACHE_SECONDS).toBeLessThanOrEqual(60);
    expect(DOCUMENT_CACHE_SECONDS).toBeLessThanOrEqual(300);
    expect(NOT_FOUND_CACHE_SECONDS).toBeLessThanOrEqual(60);
  });
});

describe("Cache TTL wiring — unstable_cache called with correct revalidate (AC7)", () => {
  beforeEach(() => {
    mockUnstableCache.mockClear();
    // Return a no-op async function so the wrapped call doesn't fail
    mockUnstableCache.mockImplementation(() => async () => ({ ok: true, data: { documents: [], total: 0, page: 1, pageSize: 12 } }));
  });

  it("listPublicDocuments wires LIST_CACHE_SECONDS as revalidate with DOCUMENTS_LIST_TAG", async () => {
    const { listPublicDocuments, LIST_CACHE_SECONDS } = await import("@/lib/documents/public");
    const { DOCUMENTS_LIST_TAG, DOCUMENTS_NOT_FOUND_TAG } = await import("@/lib/cache/tags");
    await listPublicDocuments({});
    expect(mockUnstableCache).toHaveBeenCalled();
    // Match by tags to avoid relying on call order (same pattern as getPublicDocument tests below)
    const allOpts = mockUnstableCache.mock.calls.map((c) => c[2]);
    const listCallOpts = allOpts.find(
      (o) => o?.tags?.includes(DOCUMENTS_LIST_TAG) && !o?.tags?.includes(DOCUMENTS_NOT_FOUND_TAG)
    );
    expect(listCallOpts).toBeDefined();
    expect(listCallOpts?.revalidate).toBe(LIST_CACHE_SECONDS);
    expect(listCallOpts?.tags).toContain(DOCUMENTS_LIST_TAG);
  });

  it("getPublicDocument found path wires DOCUMENT_CACHE_SECONDS with DOCUMENTS_LIST_TAG", async () => {
    mockUnstableCache.mockImplementation(() => async () => ({ ok: true, document: {} }));
    const { getPublicDocument, DOCUMENT_CACHE_SECONDS } = await import("@/lib/documents/public");
    const { DOCUMENTS_LIST_TAG, DOCUMENTS_NOT_FOUND_TAG } = await import("@/lib/cache/tags");
    await getPublicDocument("some-slug");
    // Match by tags to avoid relying on call order
    const allOpts = mockUnstableCache.mock.calls.map((c) => c[2]);
    const foundCallOpts = allOpts.find(
      (o) => o?.tags?.includes(DOCUMENTS_LIST_TAG) && !o?.tags?.includes(DOCUMENTS_NOT_FOUND_TAG)
    );
    expect(foundCallOpts).toBeDefined();
    expect(foundCallOpts?.revalidate).toBe(DOCUMENT_CACHE_SECONDS);
    expect(foundCallOpts?.tags).toContain(DOCUMENTS_LIST_TAG);
  });

  it("getPublicDocument not-found path wires NOT_FOUND_CACHE_SECONDS with DOCUMENTS_NOT_FOUND_TAG", async () => {
    mockUnstableCache
      .mockImplementationOnce(() => async () => ({ ok: false, code: "not_found" }))
      .mockImplementationOnce(() => async () => ({ ok: false, code: "not_found" }));
    const { getPublicDocument, NOT_FOUND_CACHE_SECONDS } = await import("@/lib/documents/public");
    const { DOCUMENTS_NOT_FOUND_TAG } = await import("@/lib/cache/tags");
    await getPublicDocument("missing-slug");
    // Match by tags to avoid relying on call order
    const allOpts = mockUnstableCache.mock.calls.map((c) => c[2]);
    const notFoundCallOpts = allOpts.find((o) => o?.tags?.includes(DOCUMENTS_NOT_FOUND_TAG));
    expect(notFoundCallOpts).toBeDefined();
    expect(notFoundCallOpts?.revalidate).toBe(NOT_FOUND_CACHE_SECONDS);
    expect(notFoundCallOpts?.tags).toContain(DOCUMENTS_NOT_FOUND_TAG);
  });
});
