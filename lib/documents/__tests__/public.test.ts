// S-071 AC1 AC3: unit tests for listPublicDocuments and getPublicDocument.
// DB calls are mocked; these tests verify error-path branching without Supabase.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/server", () => ({ requireStaff: vi.fn() }));
vi.mock("@/lib/ratelimit/index", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/config", () => ({
  serverConfig: { documentsPageSize: 12, previewRateLimitPerMinute: 60 },
  r2Config: () => null,
}));

// unstable_cache: pass-through (calls fn directly, single invocation per cache key).
vi.mock("next/cache", () => {
  const seen = new Map<string, unknown>();
  return {
    unstable_cache: vi.fn((fn: (...args: unknown[]) => unknown, keys: string[]) => {
      const key = keys.join(",");
      return async (...args: unknown[]) => {
        if (!seen.has(key)) {
          seen.set(key, await fn(...args));
        }
        return seen.get(key);
      };
    }),
    revalidateTag: vi.fn(),
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAnonClient: vi.fn(),
  createSupabaseServiceRoleClient: vi.fn(),
}));

import { createSupabaseAnonClient } from "@/lib/supabase/server";
import { listPublicDocuments, getPublicDocument } from "@/lib/documents/public";

const mockAnonClient = vi.mocked(createSupabaseAnonClient);

// Build a thenable Supabase-like query chain where every method returns the
// same proxy object. The chain is also a Promise (has .then) so await works.
function makeChain(resolvedValue: unknown) {
  const handler = new Proxy({} as Record<string, unknown>, {
    get(_target, prop: string) {
      if (prop === "then") {
        // Make the chain itself awaitable
        return (resolve: (v: unknown) => void) => resolve(resolvedValue);
      }
      return () => handler; // every method returns the same chain
    },
  });
  return handler;
}

beforeEach(() => vi.clearAllMocks());

// ── listPublicDocuments ──────────────────────────────────────────────────────

describe("listPublicDocuments — validation (AC1)", () => {
  it("returns validation_failed for an unknown type value", async () => {
    // No DB call needed — Zod rejects before hitting Supabase
    const result = await listPublicDocuments({ type: "not_a_kind" as never });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("validation_failed");
    }
    expect(mockAnonClient).not.toHaveBeenCalled();
  });

  it("returns validation_failed for an invalid category UUID", async () => {
    const result = await listPublicDocuments({ category: "not-a-uuid" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("validation_failed");
  });

  it("EC4: returns ok:true with empty documents array for filter with no matches", async () => {
    const chain = makeChain({ data: [], error: null, count: 0 });
    mockAnonClient.mockReturnValue({ from: vi.fn(() => chain) } as never);

    const result = await listPublicDocuments({ category: "550e8400-e29b-41d4-a716-446655440000" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.documents).toEqual([]);
      expect(result.data.total).toBe(0);
    }
  });
});

// ── getPublicDocument ────────────────────────────────────────────────────────

describe("getPublicDocument — not_found and redirect (AC3, EC5)", () => {
  it("returns not_found when no document and no redirect entry", async () => {
    // unstable_cache is a pass-through; getPublicDocument calls queryPublicDocument
    // twice (foundCached then notFoundCached). Each queryPublicDocument call:
    //   from("documents")       → null (not found)
    //   from("slug_redirects")  → null (no redirect)
    const nullResponse = { data: null, error: null };
    mockAnonClient.mockReturnValue({
      from: vi.fn(() => makeChain(nullResponse)),
    } as never);

    const result = await getPublicDocument("unknown-slug");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_found");
  });

  it("EC5: returns redirect code when slug found in slug_redirects", async () => {
    // Single-wrapper design: queryPublicDocument is called once per cache key.
    // queryPublicDocument("old-slug") makes 2 from("documents") calls:
    //   1st: main slug lookup → null (not found)
    //   2nd: current slug lookup (after redirect entity found) → {slug: "new-slug"}
    // Total from("documents") calls = 2. Odd calls → null, even → slug.
    let docCallCount = 0;
    mockAnonClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "slug_redirects") {
          return makeChain({ data: { entity_id: "doc-uuid-1" }, error: null });
        }
        docCallCount++;
        return makeChain(
          docCallCount % 2 === 0
            ? { data: { slug: "new-slug" }, error: null }
            : { data: null, error: null }
        );
      }),
    } as never);

    const result = await getPublicDocument("old-slug");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("redirect");
      if (result.code === "redirect") expect(result.newSlug).toBe("new-slug");
    }
  });
});
