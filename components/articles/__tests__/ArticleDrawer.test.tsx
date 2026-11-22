import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockBack = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: mockBack }),
}));

vi.mock("@/components/articles/ArticleBody", () => ({
  default: () => <div data-testid="article-body" />,
}));

vi.mock("@/components/articles/ArticleLikeButton", () => ({
  ArticleLikeButton: () => <div data-testid="like-button" />,
}));

vi.mock("@/lib/config.public", () => ({
  publicConfig: { mediaCdnUrl: "https://cdn.test.example.com" },
}));

import { ArticleDrawer } from "../ArticleDrawer";
import type { PublicArticle } from "@/types/article";

const article: PublicArticle = {
  id: "art-1",
  slug: "test-article",
  title: "Test Article",
  excerpt: "An excerpt",
  body: { schema_version: 1, type: "doc", content: [] },
  coverImageKey: null,
  coverImageAlt: null,
  seoTitle: null,
  seoDescription: null,
  publishedAt: "2026-01-01T00:00:00Z",
  authorName: "Alice",
  likeCount: 0,
  commentCount: 0,
  category: { id: "cat-1", name: "Safety", slug: "safety" },
  resolvedVideos: [],
  resolvedDocuments: [],
};

beforeEach(() => { mockBack.mockClear(); });

afterEach(() => {
  document.body.style.overflow = "";
});

describe("ArticleDrawer", () => {
  it("renders the article title", () => {
    render(<ArticleDrawer article={article} slug="test-article" />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Test Article")).toBeInTheDocument();
  });

  it("locks body scroll on mount and restores on unmount", () => {
    const { unmount } = render(<ArticleDrawer article={article} slug="test-article" />);
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("");
  });

  it("closes via the × button", () => {
    render(<ArticleDrawer article={article} slug="test-article" />);
    fireEvent.click(screen.getByRole("button", { name: /close article/i }));
    expect(mockBack).toHaveBeenCalledOnce();
  });

  it("closes via the Escape key", () => {
    render(<ArticleDrawer article={article} slug="test-article" />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(mockBack).toHaveBeenCalledOnce();
  });

  it("does NOT close when clicking outside the modal card (z-50 container)", () => {
    render(<ArticleDrawer article={article} slug="test-article" />);
    // The z-50 container div has no onClick — clicking it should not close
    const container = document.querySelector(".fixed.inset-0.z-50") as HTMLElement;
    fireEvent.click(container);
    expect(mockBack).not.toHaveBeenCalled();
  });
});
