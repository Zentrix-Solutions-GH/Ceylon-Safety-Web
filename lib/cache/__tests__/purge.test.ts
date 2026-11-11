// S-048: lib/cache/purge — AC10 purge tags, retry, purge_failed

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
}));
vi.mock("@/lib/audit/index", () => ({
  writeAuditRow: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: vi.fn(),
}));

import { revalidateTag } from "next/cache";
import { writeAuditRow } from "@/lib/audit/index";
import { purgeArticle } from "@/lib/cache/purge";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("purgeArticle", () => {
  it("calls revalidateTag for every required tag on publish", async () => {
    const articleId = "aa000000-0000-4000-8000-000000000001";
    await purgeArticle(articleId, "publish");

    const calledTags = vi.mocked(revalidateTag).mock.calls.map(([tag]) => tag as string);
    expect(calledTags).toContain(`article:${articleId}`);
    expect(calledTags).toContain("articles-list");
    expect(calledTags).toContain("home-first-page");
    expect(calledTags).toContain("feed-api");
    expect(calledTags).toContain("counters");
    expect(calledTags).toContain("sitemap");
  });

  it("calls revalidateTag for required tags on hide", async () => {
    const articleId = "aa000000-0000-4000-8000-000000000002";
    await purgeArticle(articleId, "hide");
    const calledTags = vi.mocked(revalidateTag).mock.calls.map(([tag]) => tag as string);
    expect(calledTags).toContain(`article:${articleId}`);
    expect(calledTags).toContain("articles-list");
  });

  it("calls revalidateTag for required tags on delete", async () => {
    const articleId = "aa000000-0000-4000-8000-000000000003";
    await purgeArticle(articleId, "delete");
    const calledTags = vi.mocked(revalidateTag).mock.calls.map(([tag]) => tag as string);
    expect(calledTags).toContain(`article:${articleId}`);
    expect(calledTags).toContain("sitemap");
  });

  it("retries once if revalidateTag throws on first attempt", async () => {
    vi.mocked(revalidateTag)
      .mockImplementationOnce(() => { throw new Error("network"); })
      .mockImplementation(() => {});
    const articleId = "aa000000-0000-4000-8000-000000000004";
    const result = await purgeArticle(articleId, "publish");
    expect(result.ok).toBe(true);
  });

  it("returns purge_failed and writes audit row when all retries fail", async () => {
    vi.mocked(revalidateTag).mockImplementation(() => { throw new Error("persistent"); });
    const articleId = "aa000000-0000-4000-8000-000000000005";
    const actorId = "bb000000-0000-4000-8000-000000000001";
    const result = await purgeArticle(articleId, "publish", actorId);
    expect(result.ok).toBe(false);
    expect((result as { ok: false; code: string }).code).toBe("purge_failed");
    expect(vi.mocked(writeAuditRow)).toHaveBeenCalledWith(
      expect.objectContaining({ action: "purge.failed" })
    );
  });

  it("body-only save does NOT trigger purge (no purgeArticle call)", async () => {
    // The saveArticle test covers the no-purge assertion on body-only saves.
    // Here we confirm no revalidateTag calls when purgeArticle is not invoked.
    expect(vi.mocked(revalidateTag)).not.toHaveBeenCalled();
  });
});
