import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({
  serverConfig: { supabaseServiceRoleKey: "srk", feedRateLimitPerMinute: 60, countersRateLimitPerMinute: 60 },
  publicConfig: { supabaseUrl: "https://test.supabase.co", supabaseAnonKey: "anon" },
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: vi.fn(),
}));
vi.mock("@/lib/ratelimit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));

import { toFeedItem } from "../query";

const baseArticleRow = {
  kind: "article",
  id: "550e8400-e29b-41d4-a716-446655440000",
  title: "Test Article",
  summary: "An excerpt",
  image: "articles/cover.jpg",
  category_id: "cat-1",
  published_at: "2026-01-15T10:00:00.000Z",
  like_count: 5,
  comment_count: 2,
  status: "published",
  deleted_at: null,
  locale: "en",
  // joined fields
  slug: "test-article",
  author_name: "Jane Doe",
};

const baseVideoRow = {
  kind: "video",
  id: "660e8400-e29b-41d4-a716-446655440001",
  title: "Test Video",
  summary: null,
  image: "videos/thumb.jpg",
  category_id: "cat-2",
  published_at: "2026-01-14T10:00:00.000Z",
  like_count: 10,
  comment_count: 0,
  status: "published",
  deleted_at: null,
  locale: "en",
  slug: null,
  author_name: null,
};

describe("toFeedItem — AC4", () => {
  it("maps article fields correctly", () => {
    const item = toFeedItem(baseArticleRow);
    expect(item.kind).toBe("article");
    expect(item.id).toBe(baseArticleRow.id);
    expect(item.slug).toBe("test-article");
    expect(item.title).toBe("Test Article");
    expect(item.coverImageKey).toBe("articles/cover.jpg");
    expect(item.categoryId).toBe("cat-1");
    expect(item.publishedAt).toBe("2026-01-15T10:00:00.000Z");
    expect(item.likeCount).toBe(5);
    expect(item.commentCount).toBe(2);
    if (item.kind === "article") {
      expect(item.excerpt).toBe("An excerpt");
      expect(item.authorName).toBe("Jane Doe");
    }
  });

  it("maps video fields correctly, no excerpt, no authorName", () => {
    const item = toFeedItem(baseVideoRow);
    expect(item.kind).toBe("video");
    expect(item.id).toBe(baseVideoRow.id);
    expect(item.slug).toBeNull();
    expect(item.coverImageKey).toBe("videos/thumb.jpg");
    expect(item.likeCount).toBe(10);
    expect(item.commentCount).toBe(0);
    expect("excerpt" in item).toBe(false);
    expect("authorName" in item).toBe(false);
  });

  it("does not expose youtube_id on video items — AC4", () => {
    const item = toFeedItem({ ...baseVideoRow, youtube_id: "dQw4w9WgXcW" });
    expect("youtubeId" in item).toBe(false);
    expect("youtube_id" in item).toBe(false);
  });
});
