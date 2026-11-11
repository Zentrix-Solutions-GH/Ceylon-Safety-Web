import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/config.public", () => ({
  publicConfig: {
    supabaseUrl: "https://test.supabase.co",
    supabaseAnonKey: "test-anon-key",
    appUrl: "https://test.example.com",
    turnstileSiteKey: "1x00000000000000000000AA",
    mediaCdnUrl: "https://cdn.example.com",
  },
}));

import { Feed } from "@/components/home/Feed";
import type { FeedPage, ArticleFeedItem, VideoFeedItem } from "@/types/api";

const article: ArticleFeedItem = {
  id: "a1",
  kind: "article",
  slug: "article-1",
  title: "Test Article",
  excerpt: "An excerpt",
  coverImageKey: null,
  categoryId: "cat-safety",
  categoryName: "Safety",
  authorName: "Alice",
  publishedAt: "2025-01-01T00:00:00Z",
  likeCount: 5,
  commentCount: 2,
};

const video: VideoFeedItem = {
  id: "v2",
  kind: "video",
  title: "Test Video",
  slug: null,
  coverImageKey: null,
  categoryId: null,
  publishedAt: "2025-01-01T00:00:00Z",
  likeCount: 3,
  commentCount: 1,
};

const firstPage: FeedPage = {
  items: [article, video],
  nextCursor: null,
};

describe("Feed", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders an article card", () => {
    render(<Feed firstPage={firstPage} autoLoadUntilPage={3} />);
    expect(screen.getByText("Test Article")).toBeInTheDocument();
  });

  it("renders a video card", () => {
    render(<Feed firstPage={firstPage} autoLoadUntilPage={3} />);
    expect(screen.getByText("Test Video")).toBeInTheDocument();
  });

  it("article card links to /articles/article-1", () => {
    render(<Feed firstPage={firstPage} autoLoadUntilPage={3} />);
    const link = screen.getByRole("link", { name: /Test Article/i });
    expect(link).toHaveAttribute("href", "/articles/article-1");
  });

  it("video card links to /?video=v2", () => {
    render(<Feed firstPage={firstPage} autoLoadUntilPage={3} />);
    const link = screen.getByRole("link", { name: /Test Video/i });
    expect(link).toHaveAttribute("href", "/?video=v2");
  });

  it("shows exact empty state message when no items", () => {
    render(<Feed firstPage={{ items: [], nextCursor: null }} autoLoadUntilPage={3} />);
    expect(
      screen.getByText("Nothing published yet. Please come back soon.")
    ).toBeInTheDocument();
  });

  it("renders category label on article card", () => {
    render(<Feed firstPage={firstPage} autoLoadUntilPage={3} />);
    expect(screen.getByText("Safety")).toBeInTheDocument();
  });

  it("does not show Load more button when nextCursor is null", () => {
    render(<Feed firstPage={firstPage} autoLoadUntilPage={3} />);
    expect(screen.queryByRole("button", { name: /load more/i })).not.toBeInTheDocument();
  });

  it("shows error message when fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));
    const pageWithCursor: FeedPage = { ...firstPage, nextCursor: "cursor-abc" };
    render(<Feed firstPage={pageWithCursor} autoLoadUntilPage={1} />);
    const btn = screen.getByRole("button", { name: /load more/i });
    btn.click();
    await waitFor(() =>
      expect(screen.getByText(/could not load more/i)).toBeInTheDocument()
    );
  });

  it("shows retry button after error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));
    const pageWithCursor: FeedPage = { ...firstPage, nextCursor: "cursor-abc" };
    render(<Feed firstPage={pageWithCursor} autoLoadUntilPage={1} />);
    screen.getByRole("button", { name: /load more/i }).click();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument()
    );
  });
});
