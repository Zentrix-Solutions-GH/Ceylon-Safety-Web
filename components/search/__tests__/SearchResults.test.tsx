import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import type { SearchResultItem } from "@/types/api";
import SearchResults from "@/components/search/SearchResults";

const article: SearchResultItem = {
  kind: "article",
  id: "a1",
  slug: "fire-safety-basics",
  title: "Fire Safety Basics",
  shortText: "Learn the basics of fire safety.",
  coverImageKey: null,
  categoryName: "Fire Safety",
};

const doc: SearchResultItem = {
  kind: "document",
  id: "d1",
  slug: "fire-checklist",
  title: "Fire Checklist",
  shortText: "A comprehensive checklist.",
  coverImageKey: null,
  categoryName: null,
};

describe("SearchResults", () => {
  it("AC5: shows 'No results found.' when items is empty", () => {
    render(<SearchResults status="success" items={[]} />);
    expect(screen.getByText("No results found.")).toBeInTheDocument();
  });

  it("AC6: shows skeleton while loading", () => {
    render(<SearchResults status="loading" items={[]} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("AC6: shows rate-limited message on rate_limited error", () => {
    render(<SearchResults status="rate_limited" items={[]} />);
    expect(screen.getByText(/too many searches/i)).toBeInTheDocument();
  });

  it("AC6: shows generic error message on error", () => {
    render(<SearchResults status="error" items={[]} />);
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });

  it("AC4: article links to /articles/[slug]", () => {
    render(<SearchResults status="success" items={[article]} />);
    const link = screen.getByRole("link", { name: /fire safety basics/i });
    expect(link).toHaveAttribute("href", "/articles/fire-safety-basics");
  });

  it("AC4: document links to /documents?document=[slug]", () => {
    render(<SearchResults status="success" items={[doc]} />);
    const link = screen.getByRole("link", { name: /fire checklist/i });
    expect(link).toHaveAttribute("href", "/documents?document=fire-checklist");
  });

  it("AC4: shows kind label for article", () => {
    render(<SearchResults status="success" items={[article]} />);
    expect(screen.getByText(/article/i)).toBeInTheDocument();
  });

  it("AC4: shows kind label for document", () => {
    render(<SearchResults status="success" items={[doc]} />);
    expect(screen.getByText(/document/i)).toBeInTheDocument();
  });

  it("AC4: shows shortText", () => {
    render(<SearchResults status="success" items={[article]} />);
    expect(screen.getByText("Learn the basics of fire safety.")).toBeInTheDocument();
  });

  it("AC8: results are in a list with a heading", () => {
    render(<SearchResults status="success" items={[article, doc]} />);
    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getByRole("heading")).toBeInTheDocument();
  });

  it("EC2: script text is rendered as plain text, not executed", () => {
    const xssItem: SearchResultItem = {
      ...article,
      title: "<script>alert('xss')</script>",
    };
    render(<SearchResults status="success" items={[xssItem]} />);
    expect(screen.getByText("<script>alert('xss')</script>")).toBeInTheDocument();
  });
});
