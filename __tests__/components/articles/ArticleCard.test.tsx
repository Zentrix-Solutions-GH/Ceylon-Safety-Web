import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import * as React from "react";
import { ArticleCardUI } from "@/components/articles/ArticleCard";

const baseProps = {
  slug: "test-article",
  title: "Test Article Title",
  excerpt: "A short excerpt for testing.",
  coverUrl: "https://img.example.com/cover.jpg",
  coverAlt: "Cover image",
  categoryName: "Safety",
  authorName: "John Doe",
  publishedAt: "2026-01-15T08:00:00Z",
  likeCount: 5,
  commentCount: 3,
};

describe("ArticleCardUI", () => {
  it("AC1: renders title, excerpt, category, author, like and comment counts", () => {
    render(<ArticleCardUI {...baseProps} />);
    expect(screen.getByText("Test Article Title")).toBeInTheDocument();
    expect(screen.getByText("A short excerpt for testing.")).toBeInTheDocument();
    expect(screen.getByText("Safety")).toBeInTheDocument();
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("AC1: cover image renders with correct src and alt", () => {
    render(<ArticleCardUI {...baseProps} />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "https://img.example.com/cover.jpg");
    expect(img).toHaveAttribute("alt", "Cover image");
  });

  it("EC3: null coverUrl renders placeholder image", () => {
    render(<ArticleCardUI {...baseProps} coverUrl={undefined} coverAlt={undefined} />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", expect.stringContaining("placeholder"));
  });

  it("EC3: broken image src triggers onError fallback to placeholder", () => {
    render(<ArticleCardUI {...baseProps} />);
    const img = screen.getByRole("img") as HTMLImageElement;
    // Simulate a failed image load
    img.dispatchEvent(new Event("error", { bubbles: true }));
    expect(img.src).toContain("placeholder");
  });

  it("AC1: like and comment counts have accessible aria-labels", () => {
    render(<ArticleCardUI {...baseProps} />);
    expect(screen.getByLabelText("5 likes")).toBeInTheDocument();
    expect(screen.getByLabelText("3 comments")).toBeInTheDocument();
  });

  it("AC7: card links to /articles/[slug]", () => {
    render(<ArticleCardUI {...baseProps} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/articles/test-article");
  });

  it("renders published date", () => {
    render(<ArticleCardUI {...baseProps} />);
    // Date formatted — just check the year is present
    expect(screen.getByText(/2026/)).toBeInTheDocument();
  });
});
