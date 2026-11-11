// S-058: admin articles list — AC1, AC2, AC3, AC4, EC1

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

vi.mock("@/lib/config.ts", () => ({
  config: {
    supabaseUrl: "https://test.supabase.co",
    supabaseAnonKey: "anon",
    supabaseServiceRoleKey: "service",
    appUrl: "https://ceylonsafety.com",
    mediaCdnUrl: "https://cdn.test",
  },
}));

const mockRouterReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockRouterReplace, push: vi.fn(), refresh: vi.fn() }),
  redirect: vi.fn((url: string): never => { throw new Error(`NEXT_REDIRECT:${url}`); }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) =>
    React.createElement("a", { href }, children),
}));

import ArticlesPageClient from "@/app/admin/articles/ArticlesPageClient";
import type { AdminArticleRow } from "@/types/article";
import type { Category } from "@/types/article";

const CATEGORIES: Category[] = [
  { id: "cat-1", name: "Safety Signs", slug: "safety-signs" },
];

const ARTICLES: AdminArticleRow[] = [
  {
    id: "art-1",
    slug: "first-article",
    title: "First Article",
    status: "published",
    categorySlug: "safety-signs",
    categoryName: "Safety Signs",
    authorName: "Alice",
    updatedAt: "2026-10-01T10:00:00Z",
  },
  {
    id: "art-2",
    slug: "second-article",
    title: "Second Article",
    status: "draft",
    categorySlug: "safety-signs",
    categoryName: "Safety Signs",
    authorName: "Bob",
    updatedAt: "2026-10-02T10:00:00Z",
  },
];

beforeEach(() => {
  mockRouterReplace.mockClear();
  // mock window.location.search
  Object.defineProperty(window, "location", {
    value: { search: "" },
    writable: true,
  });
});

describe("ArticlesPageClient — AC1 (renders list)", () => {
  it("renders article titles and status badges", () => {
    render(
      <ArticlesPageClient
        initialArticles={ARTICLES}
        pageCount={1}
        currentPage={1}
        categories={CATEGORIES}
        initialStatus=""
        initialCategory=""
        initialTitle=""
      />
    );
    expect(screen.getByText("First Article")).toBeTruthy();
    expect(screen.getByText("Second Article")).toBeTruthy();
    expect(screen.getByTestId("status-badge-art-1")).toBeTruthy();
    expect(screen.getByTestId("status-badge-art-2")).toBeTruthy();
  });
});

describe("ArticlesPageClient — AC2 (status filter)", () => {
  it("calls router.replace with status=draft when draft selected", async () => {
    const user = userEvent.setup();
    render(
      <ArticlesPageClient
        initialArticles={ARTICLES}
        pageCount={1}
        currentPage={1}
        categories={CATEGORIES}
        initialStatus=""
        initialCategory=""
        initialTitle=""
      />
    );
    const statusSelect = screen.getByTestId("filter-status");
    await user.selectOptions(statusSelect, "draft");
    expect(mockRouterReplace).toHaveBeenCalledWith(expect.stringContaining("status=draft"));
  });
});

describe("ArticlesPageClient — AC3 (title filter debounce)", () => {
  it("does NOT call router.replace for single-char input", async () => {
    const user = userEvent.setup();
    render(
      <ArticlesPageClient
        initialArticles={ARTICLES}
        pageCount={1}
        currentPage={1}
        categories={CATEGORIES}
        initialStatus=""
        initialCategory=""
        initialTitle=""
      />
    );
    const titleInput = screen.getByTestId("filter-title");
    await user.type(titleInput, "F");
    // debounce fires after 300ms; single char should not trigger router call with title=
    const calls = mockRouterReplace.mock.calls.filter((c) =>
      String(c[0]).includes("title=")
    );
    expect(calls.length).toBe(0);
  });
});

describe("ArticlesPageClient — AC4 (links)", () => {
  it("renders New article link and edit links per row", () => {
    render(
      <ArticlesPageClient
        initialArticles={ARTICLES}
        pageCount={1}
        currentPage={1}
        categories={CATEGORIES}
        initialStatus=""
        initialCategory=""
        initialTitle=""
      />
    );
    expect(screen.getByRole("link", { name: /new article/i })).toHaveAttribute(
      "href",
      "/admin/articles/new"
    );
    const editLinks = screen.getAllByRole("link", { name: /edit/i });
    expect(editLinks.length).toBeGreaterThanOrEqual(1);
  });
});

describe("ArticlesPageClient — EC1 (empty state)", () => {
  it("shows empty state and clear filters link when no articles", () => {
    render(
      <ArticlesPageClient
        initialArticles={[]}
        pageCount={0}
        currentPage={1}
        categories={CATEGORIES}
        initialStatus=""
        initialCategory=""
        initialTitle=""
      />
    );
    expect(screen.getByTestId("articles-empty")).toBeTruthy();
    expect(screen.getByRole("link", { name: /clear filters/i })).toHaveAttribute(
      "href",
      "/admin/articles"
    );
  });
});
