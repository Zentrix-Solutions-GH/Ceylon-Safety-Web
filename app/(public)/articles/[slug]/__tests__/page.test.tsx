// S-060: /articles/[slug] page — AC1, AC2, AC3, AC4, AC5, AC6
// S-061: prop-wiring for engagement components

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

vi.mock("@/lib/config.public", () => ({
  publicConfig: {
    supabaseUrl: "https://test.supabase.co",
    supabaseAnonKey: "anon",
    appUrl: "https://ceylonsafety.com",
    turnstileSiteKey: "test-key",
    mediaCdnUrl: "https://cdn.test",
  },
}));

const mockGetArticle = vi.fn();
vi.mock("@/lib/articles/getArticle", () => ({
  getArticle: (...args: unknown[]) => mockGetArticle(...args),
}));

const mockListComments = vi.fn();
vi.mock("@/lib/engagement/listComments", () => ({
  listComments: (...args: unknown[]) => mockListComments(...args),
}));

const mockNotFound = vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); });
const mockRedirect = vi.fn((url: string): never => { throw new Error(`NEXT_REDIRECT:${url}`); });
vi.mock("next/navigation", () => ({
  notFound: () => mockNotFound(),
  permanentRedirect: (url: string) => mockRedirect(url),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) =>
    React.createElement("a", { href }, children),
}));

vi.mock("@/components/articles/ArticleBody", () => ({
  default: () => React.createElement("div", { "data-testid": "article-body" }),
}));

const mockLikeButtonProps = vi.fn();
vi.mock("@/components/articles/ArticleLikeButton", () => ({
  ArticleLikeButton: (props: Record<string, unknown>) => {
    mockLikeButtonProps(props);
    return React.createElement("div", { "data-testid": "like-button" });
  },
}));

const mockCommentFormProps = vi.fn();
vi.mock("@/components/articles/CommentForm", () => ({
  CommentForm: (props: Record<string, unknown>) => {
    mockCommentFormProps(props);
    return React.createElement("div", { "data-testid": "comment-form" });
  },
}));

const mockCommentThreadProps = vi.fn();
vi.mock("@/components/articles/CommentThread", () => ({
  CommentThread: (props: Record<string, unknown>) => {
    mockCommentThreadProps(props);
    return React.createElement("div", { "data-testid": "comment-thread" });
  },
}));

import ArticleSlugPage, { generateMetadata, revalidate } from "../page";
import type { PublicArticle } from "@/types/article";

const ARTICLE: PublicArticle = {
  id: "1",
  slug: "test-slug",
  title: "Test Article",
  excerpt: "An excerpt",
  coverImageKey: null,
  coverImageAlt: null,
  seoTitle: null,
  seoDescription: null,
  category: { id: "c1", name: "Safety", slug: "safety" },
  authorName: "Jane Doe",
  publishedAt: "2026-01-01T00:00:00Z",
  body: { schema_version: 1, type: "doc", content: [] },
  likeCount: 42,
  commentCount: 3,
  resolvedVideos: [],
  resolvedDocuments: [],
};

const COMMENTS_RESPONSE = {
  comments: [{ id: "c1", articleId: "1", author: { displayName: "Bob", isStaff: false }, body: "Hi", createdAt: "2026-01-01T00:00:00Z" }],
  nextCursor: { createdAt: "2026-01-01T00:00:00Z", id: "c1" },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ArticleSlugPage — AC1, AC6", () => {
  it("renders article with back link and article body", async () => {
    mockGetArticle.mockResolvedValue({ ok: true, data: ARTICLE });
    mockListComments.mockResolvedValue(COMMENTS_RESPONSE);
    const jsx = await ArticleSlugPage({ params: Promise.resolve({ slug: "test-slug" }) });
    render(jsx as React.ReactElement);
    expect(screen.getByRole("link", { name: /back to articles/i })).toHaveAttribute("href", "/articles");
    expect(screen.getByTestId("article-body")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: "Test Article" })).toBeTruthy();
  });
});

describe("ArticleSlugPage — AC3: redirect", () => {
  it("redirects to new slug when getArticle returns redirect", async () => {
    mockGetArticle.mockResolvedValue({ ok: false, code: "redirect", newSlug: "new-slug" });
    await expect(
      ArticleSlugPage({ params: Promise.resolve({ slug: "old-slug" }) })
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith("/articles/new-slug");
  });
});

describe("ArticleSlugPage — AC3: 404", () => {
  it("calls notFound when no article and no redirect", async () => {
    mockGetArticle.mockResolvedValue({ ok: false, code: "not_found" });
    await expect(
      ArticleSlugPage({ params: Promise.resolve({ slug: "ghost-slug" }) })
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mockNotFound).toHaveBeenCalled();
  });
});

describe("generateMetadata — AC2", () => {
  it("returns canonical, title, description, og for a published article", async () => {
    mockGetArticle.mockResolvedValue({ ok: true, data: ARTICLE });
    const meta = await generateMetadata({ params: Promise.resolve({ slug: "test-slug" }) });
    expect((meta.alternates as { canonical: string }).canonical).toMatch(/\/articles\/test-slug$/);
    expect(meta.title).toBe("Test Article");
    expect(meta.description).toBe("An excerpt");
    expect((meta.openGraph as { title: string }).title).toBe("Test Article");
    expect((meta.openGraph as { description: string }).description).toBe("An excerpt");
  });

  it("includes og:image when coverImageKey is set — AC2", async () => {
    const withCover: PublicArticle = { ...ARTICLE, coverImageKey: "imgs/cover.jpg" };
    mockGetArticle.mockResolvedValue({ ok: true, data: withCover });
    const meta = await generateMetadata({ params: Promise.resolve({ slug: "test-slug" }) });
    const images = (meta.openGraph as { images?: { url: string }[] }).images;
    expect(images?.[0]?.url).toBe("https://cdn.test/imgs/cover.jpg");
  });

  it("returns noindex for an unknown slug — AC4", async () => {
    mockGetArticle.mockResolvedValue({ ok: false, code: "not_found" });
    const meta = await generateMetadata({ params: Promise.resolve({ slug: "ghost" }) });
    expect((meta.robots as { index: boolean }).index).toBe(false);
  });
});

describe("revalidate — AC5", () => {
  it("is 300", () => {
    expect(revalidate).toBe(300);
  });
});

describe("ArticleSlugPage — engagement component prop wiring (S-061)", () => {
  it("passes initialCount and slug to ArticleLikeButton", async () => {
    mockGetArticle.mockResolvedValue({ ok: true, data: ARTICLE });
    mockListComments.mockResolvedValue(COMMENTS_RESPONSE);
    const jsx = await ArticleSlugPage({ params: Promise.resolve({ slug: "test-slug" }) });
    render(jsx as React.ReactElement);
    expect(mockLikeButtonProps).toHaveBeenCalledWith(
      expect.objectContaining({ articleId: "1", slug: "test-slug", initialCount: 42 }),
    );
  });

  it("passes articleId to CommentForm", async () => {
    mockGetArticle.mockResolvedValue({ ok: true, data: ARTICLE });
    mockListComments.mockResolvedValue(COMMENTS_RESPONSE);
    const jsx = await ArticleSlugPage({ params: Promise.resolve({ slug: "test-slug" }) });
    render(jsx as React.ReactElement);
    expect(mockCommentFormProps).toHaveBeenCalledWith(
      expect.objectContaining({ articleId: "1" }),
    );
  });

  it("passes initialComments and initialNextCursor to CommentThread", async () => {
    mockGetArticle.mockResolvedValue({ ok: true, data: ARTICLE });
    mockListComments.mockResolvedValue(COMMENTS_RESPONSE);
    const jsx = await ArticleSlugPage({ params: Promise.resolve({ slug: "test-slug" }) });
    render(jsx as React.ReactElement);
    expect(mockCommentThreadProps).toHaveBeenCalledWith(
      expect.objectContaining({
        articleId: "1",
        initialComments: COMMENTS_RESPONSE.comments,
        initialNextCursor: COMMENTS_RESPONSE.nextCursor,
      }),
    );
  });

  it("renders with empty comments when listComments throws", async () => {
    mockGetArticle.mockResolvedValue({ ok: true, data: ARTICLE });
    mockListComments.mockRejectedValue(new Error("DB error"));
    const jsx = await ArticleSlugPage({ params: Promise.resolve({ slug: "test-slug" }) });
    render(jsx as React.ReactElement);
    expect(mockCommentThreadProps).toHaveBeenCalledWith(
      expect.objectContaining({ initialComments: [], initialNextCursor: null }),
    );
  });
});
