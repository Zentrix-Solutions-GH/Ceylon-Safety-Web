// S-060: /articles/[slug] page — AC1, AC2, AC3, AC4, AC5, AC6

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

const mockMaybeSingle = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAnonClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: mockMaybeSingle,
          }),
        }),
      }),
    }),
  }),
}));

const mockNotFound = vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); });
const mockRedirect = vi.fn((url: string): never => { throw new Error(`NEXT_REDIRECT:${url}`); });
vi.mock("next/navigation", () => ({
  notFound: () => mockNotFound(),
  redirect: (url: string) => mockRedirect(url),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) =>
    React.createElement("a", { href }, children),
}));

vi.mock("@/components/articles/ArticleBody", () => ({
  default: () => React.createElement("div", { "data-testid": "article-body" }),
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
  likeCount: 0,
  commentCount: 0,
  resolvedVideos: [],
  resolvedDocuments: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockMaybeSingle.mockResolvedValue({ data: null });
});

describe("ArticleSlugPage — AC1, AC6", () => {
  it("renders article with back link and article body", async () => {
    mockGetArticle.mockResolvedValue({ ok: true, data: ARTICLE });
    const jsx = await ArticleSlugPage({ params: Promise.resolve({ slug: "test-slug" }) });
    render(jsx as React.ReactElement);
    expect(screen.getByRole("link", { name: /back to articles/i })).toHaveAttribute("href", "/articles");
    expect(screen.getByTestId("article-body")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: "Test Article" })).toBeTruthy();
  });
});

describe("ArticleSlugPage — AC3: redirect", () => {
  it("redirects to new slug when slug_redirects has a match", async () => {
    mockGetArticle.mockResolvedValue({ ok: false, code: "not_found" });
    mockMaybeSingle.mockResolvedValue({ data: { new_slug: "new-slug" } });
    await expect(
      ArticleSlugPage({ params: Promise.resolve({ slug: "old-slug" }) })
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith("/articles/new-slug");
  });
});

describe("ArticleSlugPage — AC3: 404", () => {
  it("calls notFound when no article and no redirect", async () => {
    mockGetArticle.mockResolvedValue({ ok: false, code: "not_found" });
    mockMaybeSingle.mockResolvedValue({ data: null });
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
