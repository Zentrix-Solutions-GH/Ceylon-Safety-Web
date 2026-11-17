// S-072: DocumentsPageClient — filter state, debounce, URL param updates, pagination
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as React from "react";
import DocumentsPageClient from "@/app/admin/documents/DocumentsPageClient";
import type { AdminDocumentRow } from "@/types/document";
import type { Category } from "@/types/article";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockReplace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

vi.mock("@/components/admin/DocumentsTable", () => ({
  DocumentsTable: () => <div data-testid="documents-table" />,
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const CAT_ID = "11111111-1111-1111-8111-111111111111";

const CATEGORIES: Category[] = [
  { id: CAT_ID, name: "Fire Safety", slug: "fire-safety" },
];

const DEFAULT_PROPS = {
  initialRows: [] as AdminDocumentRow[],
  total: 0,
  page: 1,
  pageSize: 25,
  categories: CATEGORIES,
  initialStatus: "" as const,
  initialKind: "" as const,
  initialCategory: "",
  initialTitle: "",
};

beforeEach(() => {
  mockReplace.mockClear();
  // reset URL so window.location.search is empty each test
  window.history.replaceState({}, "", "/admin/documents");
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── Filter: status ───────────────────────────────────────────────────────────

describe("status filter", () => {
  it("calls router.replace with status param on change", async () => {
    const user = userEvent.setup();
    render(<DocumentsPageClient {...DEFAULT_PROPS} />);

    const statusSelect = screen.getByRole("combobox", {
      name: /all statuses/i,
    });
    await user.selectOptions(statusSelect, "draft");

    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringContaining("status=draft")
    );
  });

  it("removes page param when status filter changes", async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, "", "/admin/documents?page=3");

    render(<DocumentsPageClient {...DEFAULT_PROPS} page={3} total={100} />);

    await user.selectOptions(
      screen.getByRole("combobox", { name: /all statuses/i }),
      "published"
    );

    const url = mockReplace.mock.calls[0][0] as string;
    expect(url).not.toContain("page=");
    expect(url).toContain("status=published");
  });
});

// ─── Filter: kind ─────────────────────────────────────────────────────────────

describe("kind filter", () => {
  it("calls router.replace with kind param on change", async () => {
    const user = userEvent.setup();
    render(<DocumentsPageClient {...DEFAULT_PROPS} />);

    await user.selectOptions(
      screen.getByRole("combobox", { name: /all types/i }),
      "checklist"
    );

    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringContaining("kind=checklist")
    );
  });
});

// ─── Filter: category ─────────────────────────────────────────────────────────

describe("category filter", () => {
  it("calls router.replace with category param on change", async () => {
    const user = userEvent.setup();
    render(<DocumentsPageClient {...DEFAULT_PROPS} />);

    await user.selectOptions(
      screen.getByRole("combobox", { name: /all categories/i }),
      CAT_ID
    );

    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringContaining(`category=${CAT_ID}`)
    );
  });
});

// ─── Filter: title (debounced) ────────────────────────────────────────────────

describe("title filter debounce", () => {
  it("calls router.replace with search param after 300 ms", () => {
    vi.useFakeTimers();

    render(<DocumentsPageClient {...DEFAULT_PROPS} />);

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "fire" } });

    expect(mockReplace).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(300); });

    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringContaining("search=fire")
    );
  });

  it("fires only once for rapid keystrokes", () => {
    vi.useFakeTimers();

    render(<DocumentsPageClient {...DEFAULT_PROPS} />);

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "a" } });
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "ab" } });
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "abc" } });

    act(() => { vi.advanceTimersByTime(300); });

    // Only the final debounced call fires
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith(expect.stringContaining("search=abc"));
  });
});

// ─── Pagination ───────────────────────────────────────────────────────────────

describe("pagination buttons", () => {
  it("hides prev and next buttons on a single-page result", () => {
    render(<DocumentsPageClient {...DEFAULT_PROPS} total={10} page={1} pageSize={25} />);

    expect(screen.queryByRole("button", { name: /prev/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /next/i })).not.toBeInTheDocument();
  });

  it("hides prev button on page 1 of multi-page result", () => {
    render(<DocumentsPageClient {...DEFAULT_PROPS} total={100} page={1} pageSize={25} />);

    expect(screen.queryByRole("button", { name: /prev/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next/i })).toBeInTheDocument();
  });

  it("hides next button on last page", () => {
    render(<DocumentsPageClient {...DEFAULT_PROPS} total={50} page={2} pageSize={25} />);

    expect(screen.getByRole("button", { name: /prev/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /next/i })).not.toBeInTheDocument();
  });

  it("next button calls router.replace with page+1", () => {
    render(<DocumentsPageClient {...DEFAULT_PROPS} total={100} page={2} pageSize={25} />);

    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    expect(mockReplace).toHaveBeenCalledWith(expect.stringContaining("page=3"));
  });

  it("prev button calls router.replace with page-1", () => {
    render(<DocumentsPageClient {...DEFAULT_PROPS} total={100} page={3} pageSize={25} />);

    fireEvent.click(screen.getByRole("button", { name: /prev/i }));

    expect(mockReplace).toHaveBeenCalledWith(expect.stringContaining("page=2"));
  });
});
