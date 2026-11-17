import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as React from "react";

// Mock next/navigation for all client components under test
const mockReplace = vi.fn();
const mockPush = vi.fn();
const mockSearchParams = { get: vi.fn() };

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => "/documents",
}));

import { DocumentCard } from "@/components/documents/DocumentCard";
import { DocumentFilters } from "@/components/documents/DocumentFilters";
import { DocumentModal } from "@/components/documents/DocumentModal";
import type { PublicDocumentCard } from "@/types/document";

const MEDIA_BASE = "https://cdn.test.example.com";

function makeDoc(overrides: Partial<PublicDocumentCard> = {}): PublicDocumentCard {
  return {
    id: "doc-1",
    slug: "fire-safety-checklist",
    title: "Fire Safety Checklist",
    coverImageKey: null,
    priceCents: 150000,
    pageCount: 12,
    downloadCount: 42,
    docKind: "checklist",
    categoryId: "cat-1",
    categoryName: "Fire Safety",
    languages: ["en", "si"],
    unavailable: false,
    ...overrides,
  };
}

const CATEGORIES = [
  { id: "cat-1", name: "Fire Safety" },
  { id: "cat-2", name: "Chemical Safety" },
];

// ─── DocumentCard ─────────────────────────────────────────────────────────────

describe("DocumentCard", () => {
  it("AC1: renders title", () => {
    render(<DocumentCard doc={makeDoc()} mediaBase={MEDIA_BASE} onOpen={vi.fn()} />);
    expect(screen.getByText("Fire Safety Checklist")).toBeInTheDocument();
  });

  it("AC1: renders price formatted as LKR", () => {
    render(<DocumentCard doc={makeDoc()} mediaBase={MEDIA_BASE} onOpen={vi.fn()} />);
    // 150000 cents → LKR 1,500.00
    expect(screen.getByText(/1,500/)).toBeInTheDocument();
  });

  it("AC1: renders category name", () => {
    render(<DocumentCard doc={makeDoc()} mediaBase={MEDIA_BASE} onOpen={vi.fn()} />);
    expect(screen.getByText("Fire Safety")).toBeInTheDocument();
  });

  it("AC1: renders language badges for each available language", () => {
    render(<DocumentCard doc={makeDoc({ languages: ["en", "si", "ta"] })} mediaBase={MEDIA_BASE} onOpen={vi.fn()} />);
    expect(screen.getByText(/EN/i)).toBeInTheDocument();
    expect(screen.getByText(/SI/i)).toBeInTheDocument();
    expect(screen.getByText(/TA/i)).toBeInTheDocument();
  });

  it("EC5: only shows language badges for available languages", () => {
    render(<DocumentCard doc={makeDoc({ languages: ["en"] })} mediaBase={MEDIA_BASE} onOpen={vi.fn()} />);
    expect(screen.getByText(/EN/i)).toBeInTheDocument();
    expect(screen.queryByText(/SI/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/TA/i)).not.toBeInTheDocument();
  });

  it("AC1: shows placeholder when coverImageKey is null", () => {
    render(<DocumentCard doc={makeDoc({ coverImageKey: null })} mediaBase={MEDIA_BASE} onOpen={vi.fn()} />);
    const img = screen.getByRole("img");
    expect(img.getAttribute("src")).toContain("placeholder");
  });

  it("AC1: builds cover URL from mediaBase + coverImageKey", () => {
    render(
      <DocumentCard
        doc={makeDoc({ coverImageKey: "docs/covers/fire.jpg" })}
        mediaBase={MEDIA_BASE}
        onOpen={vi.fn()}
      />
    );
    const img = screen.getByRole("img");
    expect(img.getAttribute("src")).toBe(`${MEDIA_BASE}/docs/covers/fire.jpg`);
  });

  it("EC4: long title is rendered (truncation is CSS, not tested here)", () => {
    const longTitle = "A".repeat(200);
    render(<DocumentCard doc={makeDoc({ title: longTitle })} mediaBase={MEDIA_BASE} onOpen={vi.fn()} />);
    expect(screen.getByText(longTitle)).toBeInTheDocument();
  });

  it("AC4: clicking card calls onOpen with the slug", async () => {
    const onOpen = vi.fn();
    render(<DocumentCard doc={makeDoc()} mediaBase={MEDIA_BASE} onOpen={onOpen} />);
    await userEvent.click(screen.getByRole("article"));
    expect(onOpen).toHaveBeenCalledWith("fire-safety-checklist");
  });
});

// ─── DocumentFilters ──────────────────────────────────────────────────────────

describe("DocumentFilters", () => {
  beforeEach(() => {
    mockReplace.mockReset();
    mockSearchParams.get.mockReturnValue(null);
  });

  it("AC2: renders category selector and type selector", () => {
    render(<DocumentFilters categories={CATEGORIES} />);
    expect(screen.getByRole("combobox", { name: /category/i })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /type/i })).toBeInTheDocument();
  });

  it("AC2: selecting a category appends category param to URL", async () => {
    render(<DocumentFilters categories={CATEGORIES} />);
    const catSelect = screen.getByRole("combobox", { name: /category/i });
    await userEvent.selectOptions(catSelect, "cat-1");
    expect(mockReplace).toHaveBeenCalledWith(expect.stringContaining("category=cat-1"));
  });

  it("AC2: selecting a type appends type param to URL", async () => {
    render(<DocumentFilters categories={CATEGORIES} />);
    const typeSelect = screen.getByRole("combobox", { name: /type/i });
    await userEvent.selectOptions(typeSelect, "checklist");
    expect(mockReplace).toHaveBeenCalledWith(expect.stringContaining("type=checklist"));
  });

  it("AC2: clear filters button removes all query params", async () => {
    mockSearchParams.get.mockImplementation((k: string) =>
      k === "category" ? "cat-1" : k === "type" ? "checklist" : null
    );
    render(<DocumentFilters categories={CATEGORIES} />);
    await userEvent.click(screen.getByRole("button", { name: /clear/i }));
    const call = mockReplace.mock.calls[0][0] as string;
    expect(call).not.toContain("category=");
    expect(call).not.toContain("type=");
  });

  it("EC3: clear filters button not shown when no filters active", () => {
    render(<DocumentFilters categories={CATEGORIES} />);
    expect(screen.queryByRole("button", { name: /clear/i })).not.toBeInTheDocument();
  });

  it("AC3: search input submits to /search?scope=documents&q=...", async () => {
    render(<DocumentFilters categories={CATEGORIES} />);
    const input = screen.getByRole("searchbox");
    await userEvent.type(input, "fire drill");
    await userEvent.click(screen.getByRole("button", { name: /search/i }));
    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringContaining("/search?scope=documents&q=fire+drill")
    );
  });

  it("AC3: empty search query does not navigate", async () => {
    render(<DocumentFilters categories={CATEGORIES} />);
    await userEvent.click(screen.getByRole("button", { name: /search/i }));
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("AC2: selecting a category preserves an existing type param", async () => {
    mockSearchParams.get.mockImplementation((k: string) =>
      k === "type" ? "checklist" : null
    );
    render(<DocumentFilters categories={CATEGORIES} />);
    const catSelect = screen.getByRole("combobox", { name: /category/i });
    await userEvent.selectOptions(catSelect, "cat-1");
    const url = mockReplace.mock.calls[0][0] as string;
    expect(url).toContain("category=cat-1");
    expect(url).toContain("type=checklist");
  });

  it("AC2: selecting a type preserves an existing category param", async () => {
    mockSearchParams.get.mockImplementation((k: string) =>
      k === "category" ? "cat-2" : null
    );
    render(<DocumentFilters categories={CATEGORIES} />);
    const typeSelect = screen.getByRole("combobox", { name: /type/i });
    await userEvent.selectOptions(typeSelect, "safety_sign");
    const url = mockReplace.mock.calls[0][0] as string;
    expect(url).toContain("type=safety_sign");
    expect(url).toContain("category=cat-2");
  });
});

// ─── DocumentModal ────────────────────────────────────────────────────────────

describe("DocumentModal", () => {
  beforeEach(() => {
    mockReplace.mockReset();
    mockSearchParams.get.mockReturnValue(null);
  });

  it("AC4: renders nothing when no document param in URL", () => {
    mockSearchParams.get.mockReturnValue(null);
    render(<DocumentModal slug={null} onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("AC4: renders dialog when slug is provided", () => {
    render(<DocumentModal slug="fire-safety-checklist" onClose={vi.fn()} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("AC5/EC2: modal shell is null for unknown slug (EC2 enforcement is in DocumentsPageClient)", () => {
    // DocumentModal receives null when EC2 filtering rejects the slug upstream.
    // Passing null directly renders nothing.
    render(<DocumentModal slug={null} onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("AC4/EC6: close button calls onClose", async () => {
    const onClose = vi.fn();
    render(<DocumentModal slug="fire-safety-checklist" onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("AC4: modal has human-readable aria-label", () => {
    render(<DocumentModal slug="fire-safety-checklist" onClose={vi.fn()} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-label", "Document preview");
  });
});

// ─── Empty state ─────────────────────────────────────────────────────────────

import { DocumentGrid } from "@/components/documents/DocumentGrid";

describe("DocumentGrid", () => {
  it("EC1: renders empty state when no documents", () => {
    render(<DocumentGrid docs={[]} mediaBase={MEDIA_BASE} onOpen={vi.fn()} />);
    expect(screen.getByText(/no documents are available/i)).toBeInTheDocument();
  });

  it("EC3: renders filtered empty state when isFiltered=true", () => {
    render(<DocumentGrid docs={[]} mediaBase={MEDIA_BASE} onOpen={vi.fn()} isFiltered={true} />);
    expect(screen.getByText(/no documents match/i)).toBeInTheDocument();
  });

  it("AC1: renders a card for each document", () => {
    const docs = [makeDoc(), makeDoc({ id: "doc-2", slug: "chemical-safety", title: "Chemical Safety Sign" })];
    render(<DocumentGrid docs={docs} mediaBase={MEDIA_BASE} onOpen={vi.fn()} />);
    expect(screen.getByText("Fire Safety Checklist")).toBeInTheDocument();
    expect(screen.getByText("Chemical Safety Sign")).toBeInTheDocument();
  });
});

// ─── DocumentsPageClient ──────────────────────────────────────────────────────

import { DocumentsPageClient } from "@/components/documents/DocumentsPageClient";

describe("DocumentsPageClient", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockReplace.mockReset();
    mockSearchParams.get.mockReturnValue(null);
  });

  it("EC2: modal opens for a slug in allSlugs even when not in filtered docs", () => {
    // docs is filtered (only checklist); allSlugs includes a safety_sign slug
    const filteredDocs = [makeDoc({ docKind: "checklist" })];
    mockSearchParams.get.mockImplementation((k: string) =>
      k === "document" ? "fire-safety-sign" : k === "type" ? "checklist" : null
    );
    render(
      <DocumentsPageClient
        docs={filteredDocs}
        mediaBase={MEDIA_BASE}
        allSlugs={["fire-safety-checklist", "fire-safety-sign"]}
      />
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("EC2: modal does not open for a slug absent from allSlugs (deleted/unpublished)", () => {
    mockSearchParams.get.mockImplementation((k: string) =>
      k === "document" ? "deleted-doc" : null
    );
    render(
      <DocumentsPageClient
        docs={[makeDoc()]}
        mediaBase={MEDIA_BASE}
        allSlugs={["fire-safety-checklist"]}
      />
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("EC6: onClose restores scroll position captured at modal open", async () => {
    const scrollTo = vi.fn();
    Object.defineProperty(window, "scrollTo", { value: scrollTo, writable: true });
    Object.defineProperty(window, "scrollY", { value: 500, writable: true, configurable: true });

    // Start with modal open
    mockSearchParams.get.mockImplementation((k: string) =>
      k === "document" ? "fire-safety-checklist" : null
    );
    render(
      <DocumentsPageClient
        docs={[makeDoc()]}
        mediaBase={MEDIA_BASE}
        allSlugs={["fire-safety-checklist"]}
      />
    );

    // Simulate opening the modal to capture scrollY
    const card = screen.getByRole("article");
    await userEvent.click(card);
    // scrollY was 500 at open time; now close the modal
    await userEvent.click(screen.getByRole("button", { name: /close/i }));
    // scrollTo should be called with the captured scroll position
    await vi.waitFor(() => {
      expect(scrollTo).toHaveBeenCalledWith({ top: 500 });
    });
  });
});
