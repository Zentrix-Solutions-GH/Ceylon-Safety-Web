// S-058: article preview page — AC5, EC2, EC3

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
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

const mockGetArticlePreview = vi.fn();
vi.mock("@/lib/articles/getArticlePreview", () => ({
  getArticlePreview: (...args: unknown[]) => mockGetArticlePreview(...args),
}));

const mockRedirect = vi.fn((url: string): never => { throw new Error(`NEXT_REDIRECT:${url}`); });
vi.mock("next/navigation", () => ({
  redirect: (url: string) => mockRedirect(url),
}));

vi.mock("@/components/articles/ArticleBody", () => ({
  default: () => React.createElement("div", { "data-testid": "article-body" }),
}));

import PreviewPageInner from "@/app/admin/articles/[id]/preview/PreviewPageInner";
import { renderPreviewOrRedirect } from "@/app/admin/articles/[id]/preview/renderPreviewOrRedirect";
import type { ArticlePreviewData } from "@/types/article";

const PREVIEW_DATA: ArticlePreviewData = {
  id: "art-1",
  slug: "test-article",
  title: "Test Article Title",
  excerpt: "Test excerpt",
  coverImageKey: null,
  coverImageAlt: null,
  seoTitle: null,
  seoDescription: null,
  category: { id: "cat-1", name: "Safety", slug: "safety" },
  authorName: "Alice",
  publishedAt: "2026-11-01T10:00:00Z",
  body: { schema_version: 1, type: "doc", content: [] },
  likeCount: 0,
  commentCount: 0,
  resolvedVideos: [],
  resolvedDocuments: [],
  status: "draft",
  coverImageStatus: null,
};

beforeEach(() => {
  mockGetArticlePreview.mockReset();
  mockRedirect.mockClear();
});

describe("PreviewPageInner — AC5 (preview banner)", () => {
  it("renders preview banner and article title", () => {
    render(<PreviewPageInner data={PREVIEW_DATA} />);
    expect(screen.getByTestId("preview-banner")).toBeTruthy();
    expect(screen.getByText("Test Article Title")).toBeTruthy();
  });
});

describe("renderPreviewOrRedirect — EC2 (not_allowed)", () => {
  it("redirects to /admin when not_allowed", async () => {
    mockGetArticlePreview.mockResolvedValue({ ok: false, code: "not_allowed" });
    await expect(renderPreviewOrRedirect("art-1")).rejects.toThrow("NEXT_REDIRECT:/admin");
    expect(mockRedirect).toHaveBeenCalledWith("/admin");
  });
});

describe("PreviewPageInner — EC3 (cover image pending)", () => {
  it("shows cover-image-pending-notice when coverImageKey set and status=pending", () => {
    render(
      <PreviewPageInner
        data={{ ...PREVIEW_DATA, coverImageKey: "some-key", coverImageStatus: "pending" }}
      />
    );
    expect(screen.getByTestId("cover-image-pending-notice")).toBeTruthy();
  });

  it("does NOT show cover-image-pending-notice when status is not pending", () => {
    render(
      <PreviewPageInner
        data={{ ...PREVIEW_DATA, coverImageKey: "some-key", coverImageStatus: "ready" }}
      />
    );
    expect(screen.queryByTestId("cover-image-pending-notice")).toBeNull();
  });
});
