import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as React from "react";
import { ArticleFilters } from "@/components/articles/ArticleFilters";

const mockReplace = vi.fn();
const mockSearchParams = { get: vi.fn() };

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => "/articles",
}));

const categories = [
  { id: "1", name: "Safety", slug: "safety" },
  { id: "2", name: "Fire", slug: "fire" },
];

describe("ArticleFilters", () => {
  beforeEach(() => {
    mockReplace.mockReset();
    mockSearchParams.get.mockReturnValue(null);
  });

  it("AC2: renders category pill buttons and range tab buttons", () => {
    render(<ArticleFilters categories={categories} />);
    // "All" pill is always present
    expect(screen.getByRole("button", { name: /all categories/i })).toBeInTheDocument();
    // Category pills
    expect(screen.getByRole("button", { name: /safety/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /fire/i })).toBeInTheDocument();
    // Range tabs
    expect(screen.getByRole("button", { name: /newest/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /last week/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /last month/i })).toBeInTheDocument();
  });

  it("AC2: clicking Last week tab updates URL with range=week", async () => {
    render(<ArticleFilters categories={categories} />);
    await userEvent.click(screen.getByRole("button", { name: /last week/i }));
    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringContaining("range=week")
    );
  });

  it("AC2: clicking Newest tab removes range param from URL", async () => {
    mockSearchParams.get.mockImplementation((k: string) =>
      k === "range" ? "week" : null
    );
    render(<ArticleFilters categories={categories} />);
    await userEvent.click(screen.getByRole("button", { name: /newest/i }));
    const call = mockReplace.mock.calls[0][0] as string;
    expect(call).not.toContain("range=");
  });

  it("AC2: clicking a category pill updates URL with category param", async () => {
    render(<ArticleFilters categories={categories} />);
    await userEvent.click(screen.getByRole("button", { name: /safety/i }));
    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringContaining("category=safety")
    );
  });

  it("AC2: clicking All pill removes category param", async () => {
    mockSearchParams.get.mockImplementation((k: string) =>
      k === "category" ? "safety" : null
    );
    render(<ArticleFilters categories={categories} />);
    await userEvent.click(screen.getByRole("button", { name: /all categories/i }));
    const call = mockReplace.mock.calls[0][0] as string;
    expect(call).not.toContain("category=");
  });

  it("EC1: unknown category slug — All pill is active (no category= in URL on mount)", () => {
    mockSearchParams.get.mockImplementation((k: string) =>
      k === "category" ? "unknown-slug-xyz" : null
    );
    render(<ArticleFilters categories={categories} />);
    // All pill should be rendered as active (bg-red-600 class is on it)
    const allBtn = screen.getByRole("button", { name: /all categories/i });
    expect(allBtn.className).toContain("bg-red-600");
  });

  it("EC2: unknown range value — Newest tab is active", () => {
    mockSearchParams.get.mockImplementation((k: string) =>
      k === "range" ? "quarterly" : null
    );
    render(<ArticleFilters categories={categories} />);
    // Newest button should be rendered as active (bg-gray-900 class is on it)
    const newestBtn = screen.getByRole("button", { name: /newest/i });
    expect(newestBtn.className).toContain("bg-gray-900");
  });
});
