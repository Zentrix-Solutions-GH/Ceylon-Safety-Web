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

  it("AC2: renders category pill buttons and sort-by select", () => {
    render(<ArticleFilters categories={categories} />);
    // "All" pill is always present (categories.filter.category.all = "All")
    expect(screen.getByRole("button", { name: /^all$/i })).toBeInTheDocument();
    // Category pills
    expect(screen.getByRole("button", { name: /safety/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /fire/i })).toBeInTheDocument();
    // Sort-by is now a <select>, not buttons
    const select = screen.getByRole("combobox");
    expect(select).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /newest first/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /last week/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /last month/i })).toBeInTheDocument();
  });

  it("AC2: selecting Last week updates URL with range=week", async () => {
    render(<ArticleFilters categories={categories} />);
    await userEvent.selectOptions(screen.getByRole("combobox"), "week");
    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringContaining("range=week")
    );
  });

  it("AC2: selecting Newest first removes range param from URL", async () => {
    mockSearchParams.get.mockImplementation((k: string) =>
      k === "range" ? "week" : null
    );
    render(<ArticleFilters categories={categories} />);
    await userEvent.selectOptions(screen.getByRole("combobox"), "newest");
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
    await userEvent.click(screen.getByRole("button", { name: /^all$/i }));
    const call = mockReplace.mock.calls[0][0] as string;
    expect(call).not.toContain("category=");
  });

  it("EC1: unknown category slug — All pill is active", () => {
    mockSearchParams.get.mockImplementation((k: string) =>
      k === "category" ? "unknown-slug-xyz" : null
    );
    render(<ArticleFilters categories={categories} />);
    const allBtn = screen.getByRole("button", { name: /^all$/i });
    expect(allBtn).toHaveAttribute("aria-pressed", "true");
  });

  it("EC2: unknown range value — select defaults to newest", () => {
    mockSearchParams.get.mockImplementation((k: string) =>
      k === "range" ? "quarterly" : null
    );
    render(<ArticleFilters categories={categories} />);
    expect(screen.getByRole("combobox")).toHaveDisplayValue(/newest first/i);
  });

  // ── Type filter tests ─────────────────────────────────────────────────────

  it("type filter: renders type pills", () => {
    render(<ArticleFilters categories={categories} />);
    expect(screen.getByRole("button", { name: /all types/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^article$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^guide$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^news$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^tip$/i })).toBeInTheDocument();
  });

  it("type filter: clicking a type pill updates URL with type param", async () => {
    render(<ArticleFilters categories={categories} />);
    await userEvent.click(screen.getByRole("button", { name: /^guide$/i }));
    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringContaining("type=guide")
    );
  });

  it("type filter: clicking All types removes type param", async () => {
    mockSearchParams.get.mockImplementation((k: string) =>
      k === "type" ? "guide" : null
    );
    render(<ArticleFilters categories={categories} />);
    await userEvent.click(screen.getByRole("button", { name: /all types/i }));
    const call = mockReplace.mock.calls[0][0] as string;
    expect(call).not.toContain("type=");
  });

  it("type filter: active type pill has aria-pressed true", () => {
    mockSearchParams.get.mockImplementation((k: string) =>
      k === "type" ? "news" : null
    );
    render(<ArticleFilters categories={categories} />);
    expect(screen.getByRole("button", { name: /^news$/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /all types/i })).toHaveAttribute("aria-pressed", "false");
  });

  it("type filter: unknown type value — All types pill is active", () => {
    mockSearchParams.get.mockImplementation((k: string) =>
      k === "type" ? "unknown-type" : null
    );
    render(<ArticleFilters categories={categories} />);
    expect(screen.getByRole("button", { name: /all types/i })).toHaveAttribute("aria-pressed", "true");
  });

  it("active chip × button removes the individual filter", async () => {
    mockSearchParams.get.mockImplementation((k: string) => {
      if (k === "category") return "safety";
      if (k === "range") return "week";
      return null;
    });
    render(<ArticleFilters categories={categories} />);
    // Click the × on the Safety chip
    await userEvent.click(screen.getByRole("button", { name: /remove safety filter/i }));
    const call = mockReplace.mock.calls[0][0] as string;
    expect(call).not.toContain("category=");
    // range should be preserved
    expect(call).toContain("range=week");
  });

  it("clearAll removes range, category, and type simultaneously", async () => {
    mockSearchParams.get.mockImplementation((k: string) => {
      if (k === "range") return "week";
      if (k === "category") return "safety";
      if (k === "type") return "guide";
      return null;
    });
    render(<ArticleFilters categories={categories} />);
    await userEvent.click(screen.getByRole("button", { name: /clear filters/i }));
    const call = mockReplace.mock.calls[0][0] as string;
    expect(call).toBe("/articles");
  });
});
