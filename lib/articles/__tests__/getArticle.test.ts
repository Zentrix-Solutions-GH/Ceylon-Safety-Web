// S-049: getArticle — AC4

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({
  serverConfig: { supabaseServiceRoleKey: "srk" },
  publicConfig: { supabaseUrl: "https://test.supabase.co", supabaseAnonKey: "anon" },
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAnonClient: vi.fn(),
  createSupabaseServiceRoleClient: vi.fn(),
}));
vi.mock("next/cache", () => ({
  unstable_cache: (fn: unknown) => fn,
  unstable_cacheTag: vi.fn(),
  unstable_cacheLife: vi.fn(),
  revalidateTag: vi.fn(),
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
}));

import { createSupabaseAnonClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getArticle, ARTICLE_LIST_CACHE_TAG, articleCacheTag, articleSlugCacheTag } from "@/lib/articles/getArticle";
import { SCHEMA_VERSION } from "@/lib/content/schema";

function makeChain(row: unknown | null, videoRows: unknown[] = []) {
  const articleChain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "is", "lte", "maybeSingle"]) {
    articleChain[m] = vi.fn().mockReturnThis();
  }
  articleChain.maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });

  const videoChain: Record<string, unknown> = {};
  for (const m of ["select", "in"]) {
    videoChain[m] = vi.fn().mockReturnThis();
  }
  videoChain.in = vi.fn().mockResolvedValue({ data: videoRows, error: null });

  const supabase = {
    from: vi.fn().mockImplementation((table: string) =>
      table === "videos" ? videoChain : articleChain
    ),
  };
  // getArticle uses anon client; resolveRefs uses service-role — both point to the same mock
  (createSupabaseAnonClient as ReturnType<typeof vi.fn>).mockReturnValue(supabase);
  (createSupabaseServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(supabase);
  return supabase;
}

const VALID_BODY = {
  schema_version: SCHEMA_VERSION,
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }],
};

const FULL_ROW = {
  id: "art-1",
  slug: "fire-safety",
  title: "Fire Safety",
  excerpt: "An excerpt",
  cover_image_key: "imgs/cover.jpg",
  cover_image_alt: "Cover",
  seo_title: null,
  seo_description: null,
  published_at: "2026-10-01T08:00:00+05:30",
  like_count: 3,
  comment_count: 1,
  body: VALID_BODY,
  categories: { id: "cat-1", name: "Fire Safety", slug: "fire-safety" },
  authors: { name: "Jane" },
  article_refs: [],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getArticle — AC4", () => {
  it("returns the article when found", async () => {
    makeChain(FULL_ROW);
    const result = await getArticle("fire-safety");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.slug).toBe("fire-safety");
    expect(result.data.authorName).toBe("Jane");
    expect(result.data.likeCount).toBe(3);
  });

  it("returns not_found for unknown slug", async () => {
    makeChain(null);
    const result = await getArticle("unknown-slug");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("not_found");
  });

  it("includes body in the response", async () => {
    makeChain(FULL_ROW);
    const result = await getArticle("fire-safety");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.body.type).toBe("doc");
  });

  it("resolves article_refs into resolvedVideos and resolvedDocuments", async () => {
    const rowWithRefs = {
      ...FULL_ROW,
      article_refs: [
        { ref_type: "video", ref_id: "vid-1", node_id: "n1", phrase: null },
        { ref_type: "video", ref_id: "vid-2", node_id: "n2", phrase: null },
        { ref_type: "document", ref_id: "doc-1", node_id: "n3", phrase: null },
      ],
    };
    const videoRows = [
      { id: "vid-1", status: "published" },
      { id: "vid-2", status: "hidden" },
    ];
    makeChain(rowWithRefs, videoRows);
    const result = await getArticle("fire-safety");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.resolvedVideos).toHaveLength(2);
    expect(result.data.resolvedVideos[0].status).toBe("published");
    expect(result.data.resolvedVideos[1].status).toBe("hidden"); // EC4: hidden video
    // document_spot always "not_shown" until S-071
    expect(result.data.resolvedDocuments).toHaveLength(1);
    expect(result.data.resolvedDocuments[0].status).toBe("not_shown");
  });
});

// ─── EC7: article with no document refs → resolvedDocuments is empty ─────────

describe("getArticle — EC7 no document refs", () => {
  it("resolvedDocuments is [] when article has no document refs", async () => {
    makeChain({ ...FULL_ROW, article_refs: [] });
    const result = await getArticle("fire-safety");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.resolvedDocuments).toEqual([]);
    expect(result.data.resolvedVideos).toEqual([]);
  });
});

// ─── AC5: cache tag constant values ──────────────────────────────────────────

describe("cache tag exports — AC5", () => {
  it("ARTICLE_LIST_CACHE_TAG is 'articles-list'", () => {
    expect(ARTICLE_LIST_CACHE_TAG).toBe("articles-list");
  });

  it("articleCacheTag returns 'article:<id>'", () => {
    expect(articleCacheTag("abc-123")).toBe("article:abc-123");
  });

  it("articleSlugCacheTag returns 'article-slug:<slug>'", () => {
    expect(articleSlugCacheTag("fire-safety")).toBe("article-slug:fire-safety");
  });
});
