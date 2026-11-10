/**
 * S-071 AC1, EC4: Integration tests for listPublicDocuments with real Supabase.
 * Run with: DOCUMENTS_PUBLIC_DB_TEST=1 npx vitest run lib/documents/__tests__/list.db.test.ts
 * Requires: local Supabase running with dev seed applied.
 */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  unstable_cache: vi.fn((fn: unknown) => fn),
  revalidateTag: vi.fn(),
}));

const ENABLED = process.env.DOCUMENTS_PUBLIC_DB_TEST === "1";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

// Known seed IDs
const DOC_FIRE_ID = "02000050-0000-0000-0000-000000000001";
const DOC_AID_ID = "02000050-0000-0000-0000-000000000002";

describe.skipIf(!ENABLED)("listPublicDocuments — filters and sort (AC1, EC4)", () => {
  let adminClient: ReturnType<typeof createClient<Database>>;

  beforeAll(() => {
    adminClient = createClient<Database>(SUPABASE_URL, SERVICE_KEY);
  });

  it("returns only published, non-deleted documents", async () => {
    const hiddenId = "02000050-ffff-0000-0000-000000000099";
    const catRes = await adminClient.from("categories").select("id").eq("slug", "fire-safety").single();
    await adminClient.from("documents").upsert({
      id: hiddenId,
      slug: "hidden-doc-s071-test",
      title: "Hidden Test Doc",
      doc_kind: "checklist",
      file_format: "pptx",
      price_cents: 1000,
      category_id: catRes.data?.id,
      status: "draft",
    }, { onConflict: "id" });

    try {
      const { listPublicDocuments } = await import("@/lib/documents/public");
      const result = await listPublicDocuments({});
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const ids = result.data.documents.map((d) => d.id);
      expect(ids).toContain(DOC_FIRE_ID);
      expect(ids).toContain(DOC_AID_ID);
      expect(ids).not.toContain(hiddenId);
    } finally {
      await adminClient.from("documents").delete().eq("id", hiddenId);
    }
  });

  it("returns only documents where published_at is not in the future", async () => {
    const futureId = "02000050-ffff-0000-0000-000000000098";
    const catRes = await adminClient.from("categories").select("id").eq("slug", "fire-safety").single();
    await adminClient.from("documents").upsert({
      id: futureId,
      slug: "future-doc-s071-test",
      title: "Future Test Doc",
      doc_kind: "checklist",
      file_format: "pptx",
      price_cents: 1000,
      category_id: catRes.data?.id,
      status: "published",
      published_at: new Date(Date.now() + 86400000).toISOString(),
    }, { onConflict: "id" });

    try {
      const { listPublicDocuments } = await import("@/lib/documents/public");
      const result = await listPublicDocuments({});
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const ids = result.data.documents.map((d) => d.id);
      expect(ids).not.toContain(futureId);
    } finally {
      await adminClient.from("documents").delete().eq("id", futureId);
    }
  });

  it("filters by type (doc_kind)", async () => {
    const { listPublicDocuments } = await import("@/lib/documents/public");
    const result = await listPublicDocuments({ type: "checklist" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ids = result.data.documents.map((d) => d.id);
    expect(ids).toContain(DOC_FIRE_ID);
    expect(ids).not.toContain(DOC_AID_ID);
  });

  it("EC4: filter combination with no match returns empty list, not error", async () => {
    const { listPublicDocuments } = await import("@/lib/documents/public");
    // Use a category UUID that has no published documents
    const result = await listPublicDocuments({ type: "safety_sign" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.documents).toHaveLength(0);
    expect(result.data.total).toBe(0);
  });

  it("EC6: page size is enforced; query respects the server-fixed limit", async () => {
    const { listPublicDocuments } = await import("@/lib/documents/public");
    const result = await listPublicDocuments({ page: 1 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // pageSize is set to 12 in serverConfig; seed has 2 docs so total ≤ 12
    expect(result.data.pageSize).toBe(12);
    expect(result.data.documents.length).toBeLessThanOrEqual(result.data.pageSize);
  });

  it("AC1: sort=popular returns documents in descending download_count order", async () => {
    // Seed has DOC_FIRE (download_count from seed) and DOC_AID. We set counts explicitly
    // so the assertion is deterministic regardless of seed values.
    await adminClient.from("documents").update({ download_count: 50 }).eq("id", DOC_FIRE_ID);
    await adminClient.from("documents").update({ download_count: 5 }).eq("id", DOC_AID_ID);

    try {
      const { listPublicDocuments } = await import("@/lib/documents/public");
      const result = await listPublicDocuments({ sort: "popular" });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const ids = result.data.documents.map((d) => d.id);
      // DOC_FIRE has the higher download_count → must appear before DOC_AID
      expect(ids.indexOf(DOC_FIRE_ID)).toBeLessThan(ids.indexOf(DOC_AID_ID));
    } finally {
      // Restore to original counts so other tests are unaffected
      await adminClient.from("documents").update({ download_count: 0 }).eq("id", DOC_FIRE_ID);
      await adminClient.from("documents").update({ download_count: 0 }).eq("id", DOC_AID_ID);
    }
  });

  it("EC1: soft-deleted document (deleted_at IS NOT NULL) does not appear in list", async () => {
    const softDeletedId = "02000050-ffff-0000-0000-000000000094";
    const catRes = await adminClient.from("categories").select("id").eq("slug", "fire-safety").single();
    await adminClient.from("documents").upsert({
      id: softDeletedId,
      slug: "soft-deleted-s071-test",
      title: "Soft Deleted Test Doc",
      doc_kind: "checklist",
      file_format: "pptx",
      price_cents: 1000,
      category_id: catRes.data?.id,
      status: "published",
      published_at: new Date(Date.now() - 86400000).toISOString(),
      deleted_at: new Date().toISOString(),
    }, { onConflict: "id" });

    try {
      const { listPublicDocuments } = await import("@/lib/documents/public");
      const result = await listPublicDocuments({});
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const ids = result.data.documents.map((d) => d.id);
      expect(ids).not.toContain(softDeletedId);
    } finally {
      await adminClient.from("documents").delete().eq("id", softDeletedId);
    }
  });
});
