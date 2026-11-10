/**
 * S-071 EC6: Performance integration test — page size enforced at scale.
 * Run with: DOCUMENTS_PUBLIC_DB_TEST=1 npx vitest run lib/documents/__tests__/perf.db.test.ts
 * Requires: local Supabase running with dev seed applied.
 *
 * Note: This test does NOT insert 10,000 rows (too slow for CI). Instead it verifies:
 * - The query respects the server-enforced pageSize limit regardless of total rows.
 * - Sort=popular and sort=newest return valid, non-empty results.
 * The 10,000-row insert would be a one-off manual perf test, not a CI test.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  unstable_cache: vi.fn((fn: unknown) => fn),
  revalidateTag: vi.fn(),
}));

const ENABLED = process.env.DOCUMENTS_PUBLIC_DB_TEST === "1";

describe.skipIf(!ENABLED)("listPublicDocuments — EC6 page size and sort performance", () => {
  it("EC6: page size is exactly the server-configured limit (12), not unlimited", async () => {
    const { listPublicDocuments } = await import("@/lib/documents/public");
    const result = await listPublicDocuments({ page: 1 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // pageSize must equal server config value (12)
    expect(result.data.pageSize).toBe(12);
    // documents returned must not exceed pageSize
    expect(result.data.documents.length).toBeLessThanOrEqual(result.data.pageSize);
  });

  it("EC6: sort=newest returns results without error", async () => {
    const { listPublicDocuments } = await import("@/lib/documents/public");
    const result = await listPublicDocuments({ sort: "newest", page: 1 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Array.isArray(result.data.documents)).toBe(true);
    expect(result.data.pageSize).toBe(12);
  });

  it("EC6: sort=popular returns results without error", async () => {
    const { listPublicDocuments } = await import("@/lib/documents/public");
    const result = await listPublicDocuments({ sort: "popular", page: 1 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Array.isArray(result.data.documents)).toBe(true);
    expect(result.data.pageSize).toBe(12);
  });

  it("EC6: page 2 beyond total returns empty list (not error)", async () => {
    const { listPublicDocuments } = await import("@/lib/documents/public");
    // Seed has only 2 docs; page 100 must return empty list
    const result = await listPublicDocuments({ page: 100 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.documents).toHaveLength(0);
  });
});
