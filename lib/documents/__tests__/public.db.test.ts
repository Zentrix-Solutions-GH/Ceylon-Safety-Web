/**
 * S-071 AC3, AC4, EC1, EC5: Integration tests for getPublicDocument with real Supabase.
 * Run with: DOCUMENTS_PUBLIC_DB_TEST=1 npx vitest run lib/documents/__tests__/public.db.test.ts
 * Requires: local Supabase running with dev seed applied.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { vi } from "vitest";
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

// Known seed values
const DOC_FIRE_ID = "02000050-0000-0000-0000-000000000001";
const DOC_FIRE_SLUG = "fire-safety-checklist";

describe.skipIf(!ENABLED)("getPublicDocument — single read and redirect (AC3, EC5)", () => {
  let adminClient: ReturnType<typeof createClient<Database>>;

  beforeAll(() => {
    adminClient = createClient<Database>(SUPABASE_URL, SERVICE_KEY);
  });

  it("returns document for a known published slug", async () => {
    const { getPublicDocument } = await import("@/lib/documents/public");
    const result = await getPublicDocument(DOC_FIRE_SLUG);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.id).toBe(DOC_FIRE_ID);
    expect(result.document.slug).toBe(DOC_FIRE_SLUG);
    // AC2: no file_key in response
    expect(result.document).not.toHaveProperty("file_key");
    expect(result.document).not.toHaveProperty("fileKey");
    // AC3: previewAvailability is present
    expect(result.document).toHaveProperty("previewAvailability");
  });

  it("EC5: returns redirect code for a slug found only in slug_redirects", async () => {
    const OLD_SLUG = "old-fire-safety-slug-s071-test";
    // Insert a redirect row
    await adminClient.from("slug_redirects").upsert({
      old_slug: OLD_SLUG,
      entity_type: "document",
      entity_id: DOC_FIRE_ID,
    }, { onConflict: "old_slug,entity_type" });

    const { getPublicDocument } = await import("@/lib/documents/public");
    const result = await getPublicDocument(OLD_SLUG);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("redirect");
    expect((result as { newSlug: string }).newSlug).toBe(DOC_FIRE_SLUG);

    await adminClient.from("slug_redirects").delete().eq("old_slug", OLD_SLUG).eq("entity_type", "document");
  });

  it("returns not_found for unknown slug", async () => {
    const { getPublicDocument } = await import("@/lib/documents/public");
    const result = await getPublicDocument("completely-unknown-slug-s071-test-xyz");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("not_found");
  });

  it("AC4: document with no ready full file is listed as unavailable", async () => {
    // Insert a published document with no document_files rows
    const noFileId = "02000050-ffff-0000-0000-000000000097";
    const noFileSlug = "no-file-doc-s071-test";
    await adminClient.from("documents").upsert({
      id: noFileId,
      slug: noFileSlug,
      title: "No File Doc",
      doc_kind: "checklist",
      file_format: "pptx",
      price_cents: 1000,
      category_id: (await adminClient.from("categories").select("id").eq("slug", "fire-safety").single()).data?.id,
      status: "published",
      published_at: new Date(Date.now() - 86400000).toISOString(),
    }, { onConflict: "id" });

    const { getPublicDocument } = await import("@/lib/documents/public");
    const result = await getPublicDocument(noFileSlug);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.unavailable).toBe(true);
    expect(result.document.languages).toHaveLength(0);

    await adminClient.from("documents").delete().eq("id", noFileId);
  });

  it("EC1: document with status=draft does not appear in single read", async () => {
    const hiddenId = "02000050-ffff-0000-0000-000000000096";
    const hiddenSlug = "hidden-doc-s071-test-ec1";
    await adminClient.from("documents").upsert({
      id: hiddenId,
      slug: hiddenSlug,
      title: "Hidden Doc",
      doc_kind: "checklist",
      file_format: "pptx",
      price_cents: 1000,
      category_id: (await adminClient.from("categories").select("id").eq("slug", "fire-safety").single()).data?.id,
      status: "draft",
    }, { onConflict: "id" });

    const { getPublicDocument } = await import("@/lib/documents/public");
    const result = await getPublicDocument(hiddenSlug);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("not_found");

    await adminClient.from("documents").delete().eq("id", hiddenId);
  });

  it("EC1: soft-deleted document does not appear in single read", async () => {
    const deletedId = "02000050-ffff-0000-0000-000000000095";
    const deletedSlug = "deleted-doc-s071-test-ec1";
    await adminClient.from("documents").upsert({
      id: deletedId,
      slug: deletedSlug,
      title: "Deleted Doc",
      doc_kind: "checklist",
      file_format: "pptx",
      price_cents: 1000,
      category_id: (await adminClient.from("categories").select("id").eq("slug", "fire-safety").single()).data?.id,
      status: "published",
      published_at: new Date(Date.now() - 86400000).toISOString(),
      deleted_at: new Date().toISOString(),
    }, { onConflict: "id" });

    const { getPublicDocument } = await import("@/lib/documents/public");
    const result = await getPublicDocument(deletedSlug);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("not_found");

    await adminClient.from("documents").delete().eq("id", deletedId);
  });
});
