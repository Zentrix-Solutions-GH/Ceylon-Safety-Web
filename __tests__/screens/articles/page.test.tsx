import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the server functions (server-only is aliased in vitest.config.ts)
vi.mock("@/lib/articles/listArticles", () => ({ listArticles: vi.fn() }));
vi.mock("@/lib/articles/listCategories", () => ({ listCategories: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => ({ get: () => null }),
  usePathname: () => "/articles",
}));

import { listArticles } from "@/lib/articles/listArticles";
import { listCategories } from "@/lib/articles/listCategories";
import type { ArticleCard } from "@/types/article";

const mockListArticles = vi.mocked(listArticles);
const mockListCategories = vi.mocked(listCategories);

function makeCard(n: number): ArticleCard {
  return {
    id: `id-${n}`,
    slug: `article-${n}`,
    title: `Article ${n}`,
    excerpt: `Excerpt ${n}`,
    coverImageKey: `covers/article-${n}.jpg`,
    coverImageAlt: `Cover ${n}`,
    category: { id: "cat-1", name: "Safety", slug: "safety" },
    authorName: "Author",
    publishedAt: "2026-01-01T00:00:00Z",
    likeCount: n,
    commentCount: 0,
  };
}

import ArticlesPageDefault, { generateMetadata } from "@/app/(public)/articles/page";

async function ArticlesPage(props: { searchParams: Record<string, string> }) {
  // Next 15 searchParams may be a Promise; pass plain object directly
  return ArticlesPageDefault({ searchParams: props.searchParams as unknown as Promise<Record<string, string>> });
}

beforeEach(() => {
  mockListArticles.mockReset();
  mockListCategories.mockResolvedValue([]);
});

describe("Articles page — AC1: renders article grid", () => {
  it("renders a list of ArticleCard components", async () => {
    mockListArticles.mockResolvedValue({
      ok: true,
      data: { items: [makeCard(1), makeCard(2)], next: null },
    });
    const el = await ArticlesPage({ searchParams: {} });
    render(el);
    expect(screen.getByText("Article 1")).toBeInTheDocument();
    expect(screen.getByText("Article 2")).toBeInTheDocument();
  });
});

describe("Articles page — AC4: empty filtered state", () => {
  it('shows "No articles match these filters." when filtered result is empty', async () => {
    mockListArticles.mockResolvedValue({ ok: true, data: { items: [], next: null } });
    const el = await ArticlesPage({ searchParams: { range: "week" } });
    render(el);
    expect(screen.getByText("No articles match these filters.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /clear filters/i })).toBeInTheDocument();
  });
});

describe("Articles page — EC4: no articles published", () => {
  it('shows "Nothing published yet." when no filters and no results', async () => {
    mockListArticles.mockResolvedValue({ ok: true, data: { items: [], next: null } });
    const el = await ArticlesPage({ searchParams: {} });
    render(el);
    expect(
      screen.getByText("Nothing published yet. Please come back soon.")
    ).toBeInTheDocument();
  });
});

describe("Articles page — AC8: noindex for filtered pages", () => {
  it("filtered page export returns noindex robots meta", async () => {
    const meta = await generateMetadata({ searchParams: { range: "week" } as unknown as Promise<Record<string, string>> });
    expect(meta?.robots).toMatchObject({ index: false });
  });

  it("base page is indexable (no noindex)", async () => {
    const meta = await generateMetadata({ searchParams: {} as unknown as Promise<Record<string, string>> });
    expect((meta?.robots as { index?: boolean } | undefined)?.index).not.toBe(false);
  });
});

describe("Articles page — EC1: unknown category slug", () => {
  it("treats unknown category as no filter", async () => {
    mockListArticles.mockResolvedValue({
      ok: true,
      data: { items: [makeCard(1)], next: null },
    });
    const el = await ArticlesPage({ searchParams: { category: "nonexistent-xyz" } });
    render(el);
    // Page should render normally (not crash or show error)
    expect(screen.getByText("Article 1")).toBeInTheDocument();
    // listArticles should have been called with the category passed through
    expect(mockListArticles).toHaveBeenCalledWith(
      expect.objectContaining({ category: "nonexistent-xyz" })
    );
  });
});

describe("Articles page — EC2: unknown range value", () => {
  it("treats unknown range as newest (no range filter)", async () => {
    mockListArticles.mockResolvedValue({
      ok: true,
      data: { items: [makeCard(1)], next: null },
    });
    const el = await ArticlesPage({ searchParams: { range: "quarterly" } });
    render(el);
    // Should call listArticles without an invalid range (falls back to newest)
    expect(mockListArticles).toHaveBeenCalledWith(
      expect.objectContaining({ range: "newest" })
    );
  });
});
