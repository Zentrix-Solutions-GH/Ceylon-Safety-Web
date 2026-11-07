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

  it("AC2: renders date range options and category dropdown", () => {
    render(<ArticleFilters categories={categories} />);
    expect(screen.getByRole("combobox", { name: /date/i })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /category/i })).toBeInTheDocument();
  });

  it("AC2: selecting Last week updates URL with range=week", async () => {
    render(<ArticleFilters categories={categories} />);
    const rangeSelect = screen.getByRole("combobox", { name: /date/i });
    await userEvent.selectOptions(rangeSelect, "week");
    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringContaining("range=week")
    );
  });

  it("AC2: selecting Newest removes range param from URL", async () => {
    mockSearchParams.get.mockImplementation((k: string) =>
      k === "range" ? "week" : null
    );
    render(<ArticleFilters categories={categories} />);
    const rangeSelect = screen.getByRole("combobox", { name: /date/i });
    await userEvent.selectOptions(rangeSelect, "newest");
    const call = mockReplace.mock.calls[0][0] as string;
    expect(call).not.toContain("range=");
  });

  it("AC2: selecting a category updates URL with category param", async () => {
    render(<ArticleFilters categories={categories} />);
    const catSelect = screen.getByRole("combobox", { name: /category/i });
    await userEvent.selectOptions(catSelect, "safety");
    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringContaining("category=safety")
    );
  });

  it("AC3: Clear filters button removes all query params", async () => {
    mockSearchParams.get.mockImplementation((k: string) =>
      k === "range" ? "week" : k === "category" ? "safety" : null
    );
    render(<ArticleFilters categories={categories} />);
    await userEvent.click(screen.getByRole("button", { name: /clear filters/i }));
    const call = mockReplace.mock.calls[0][0] as string;
    expect(call).not.toContain("range=");
    expect(call).not.toContain("category=");
  });

  it("AC5: search input navigates to /search with scope=articles", async () => {
    render(<ArticleFilters categories={categories} />);
    const input = screen.getByPlaceholderText(/search articles/i);
    await userEvent.type(input, "fire safety");
    await userEvent.click(screen.getByRole("button", { name: /^search$/i }));
    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringContaining("/search?scope=articles&q=fire+safety")
    );
  });

  it("AC5: pressing Enter on the search field also navigates", async () => {
    render(<ArticleFilters categories={categories} />);
    const input = screen.getByPlaceholderText(/search articles/i);
    await userEvent.type(input, "ladder{Enter}");
    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringContaining("/search?scope=articles&q=ladder")
    );
  });

  it("EC1: unknown category slug passed as defaultCategory — shows all categories filter as selected", () => {
    mockSearchParams.get.mockImplementation((k: string) =>
      k === "category" ? "unknown-slug-xyz" : null
    );
    render(<ArticleFilters categories={categories} />);
    const catSelect = screen.getByRole("combobox", { name: /category/i });
    expect((catSelect as HTMLSelectElement).value).toBe("");
  });

  it("EC2: unknown range value — shows Newest as selected", () => {
    mockSearchParams.get.mockImplementation((k: string) =>
      k === "range" ? "quarterly" : null
    );
    render(<ArticleFilters categories={categories} />);
    const rangeSelect = screen.getByRole("combobox", { name: /date/i });
    expect((rangeSelect as HTMLSelectElement).value).toBe("newest");
  });
});
