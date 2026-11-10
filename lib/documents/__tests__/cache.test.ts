// S-071 AC7: correct Next.js cache tags applied to public document reads.

import { describe, it, expect, vi } from "vitest";

vi.mock("next/cache", () => ({ unstable_cache: vi.fn(), revalidateTag: vi.fn() }));
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
