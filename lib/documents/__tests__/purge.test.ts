// S-070 AC7: purgeDocument — clears the right tags, returns warning on failure.
// Unit test: mocks revalidateTag and writeAuditRow.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: vi.fn(),
}));

vi.mock("@/lib/audit/index", () => ({
  writeAuditRow: vi.fn().mockResolvedValue(undefined),
}));

import { purgeDocument } from "@/lib/cache/purge";
import { writeAuditRow } from "@/lib/audit/index";
import { revalidateTag } from "next/cache";

const mockRevalidateTag = vi.mocked(revalidateTag);

const DOC_ID = "doc-uuid-1234";
const ARTICLE_IDS = ["art-uuid-0001", "art-uuid-0002"];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("purgeDocument — AC7", () => {
  it("calls revalidateTag for documents list, counters, sitemap, document page, and each article", async () => {
    mockRevalidateTag.mockImplementation(() => {}); // all succeed
    const result = await purgeDocument(DOC_ID, ARTICLE_IDS, "actor-1");
    expect(result.ok).toBe(true);

    const calledTags = mockRevalidateTag.mock.calls.map((c) => c[0]);
    expect(calledTags).toContain("documents-list");
    expect(calledTags).toContain("counters");
    expect(calledTags).toContain("sitemap");
    expect(calledTags).toContain(`document:${DOC_ID}`);
    expect(calledTags).toContain(`article:${ARTICLE_IDS[0]}`);
    expect(calledTags).toContain(`article:${ARTICLE_IDS[1]}`);
  });

  it("retries failed tags once and returns ok if second attempt succeeds", async () => {
    let callCount = 0;
    mockRevalidateTag.mockImplementation((tag: string) => {
      callCount++;
      // fail first call on sitemap, succeed on retry
      if (tag === "sitemap" && callCount === 1) throw new Error("transient");
    });
    const result = await purgeDocument(DOC_ID, [], "actor-1");
    expect(result.ok).toBe(true);
  });

  it("returns purge_failed and writes audit row when both attempts fail", async () => {
    mockRevalidateTag.mockImplementation(() => { throw new Error("cdn down"); });
    const result = await purgeDocument(DOC_ID, ARTICLE_IDS, "actor-1");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("purge_failed");
    expect(vi.mocked(writeAuditRow)).toHaveBeenCalledWith(
      expect.objectContaining({ action: "purge.failed", entityId: DOC_ID }),
    );
  });
});
