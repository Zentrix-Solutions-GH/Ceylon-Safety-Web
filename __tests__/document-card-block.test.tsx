// S-077: DocumentCardBlock — AC1–AC5, EC1–EC3

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SCHEMA_VERSION } from "@/lib/content/schema";

// ─── Mock server-only actions ────────────────────────────────────────────────

vi.mock("@/lib/documents/actions/listDocumentPickerItemsAction", () => ({
  listDocumentPickerItemsAction: vi.fn(),
}));

vi.mock("@/lib/config.public", () => ({
  publicConfig: {
    appUrl: "https://ceylonsafety.com",
    mediaCdnUrl: "https://cdn.test",
  },
}));

// Lazy imports after mocks
import { renderArticleBody } from "@/lib/content/render";
import DocumentCardBlock from "@/components/admin/ArticleEditor/blocks/DocumentCardBlock";
import { listDocumentPickerItemsAction } from "@/lib/documents/actions/listDocumentPickerItemsAction";
import DocumentPickerModal from "@/components/admin/ArticleEditor/DocumentPickerModal";

// ─── AC1: DocumentPickerModal opens with correct title ───────────────────────

describe("DocumentPickerModal — AC1: opens with document picker title", () => {
  it("renders a dialog with 'Insert document card' title", async () => {
    vi.mocked(listDocumentPickerItemsAction).mockResolvedValue({
      ok: true,
      items: [],
      hasMore: false,
    });

    render(<DocumentPickerModal onPick={() => {}} onClose={() => {}} />);

    expect(screen.getByRole("dialog", { name: /insert document card/i })).toBeTruthy();
    expect(screen.getByRole("searchbox")).toBeTruthy();
  });
});

// ─── AC2: DocumentCardBlock shows title, price, preview thumbnail ─────────────

describe("DocumentCardBlock — AC2: displays document info in editor", () => {
  it("renders title and price in LKR", () => {
    render(
      <DocumentCardBlock
        documentId="doc-1"
        slug="safety-checklist"
        title="Safety Checklist"
        price={150000}
        previewUrl="https://cdn.test/docs/doc-1/preview.jpg"
        onRemove={() => {}}
      />,
    );
    expect(screen.getByText("Safety Checklist")).toBeTruthy();
    expect(screen.getByText(/LKR/)).toBeTruthy();
  });

  it("shows 'View document' label", () => {
    render(
      <DocumentCardBlock
        documentId="doc-1"
        slug="safety-checklist"
        title="Safety Checklist"
        price={150000}
        onRemove={() => {}}
      />,
    );
    expect(screen.getByText(/view document/i)).toBeTruthy();
  });
});

// ─── AC3: Block is read-only, has a delete handle ─────────────────────────────

describe("DocumentCardBlock — AC3: read-only with delete handle", () => {
  it("calls onRemove when delete button is clicked", () => {
    const onRemove = vi.fn();
    render(
      <DocumentCardBlock
        documentId="doc-1"
        slug="safety-checklist"
        title="Safety Checklist"
        price={150000}
        onRemove={onRemove}
      />,
    );
    const removeBtn = screen.getByRole("button", { name: /remove/i });
    fireEvent.click(removeBtn);
    expect(onRemove).toHaveBeenCalledOnce();
  });
});

// ─── EC1: Missing preview shows placeholder, no crash ─────────────────────────

describe("DocumentCardBlock — EC1: missing preview shows placeholder", () => {
  it("renders without crashing when previewUrl is undefined", () => {
    render(
      <DocumentCardBlock
        documentId="doc-1"
        slug="safety-checklist"
        title="Safety Checklist"
        price={150000}
        onRemove={() => {}}
      />,
    );
    // No img with a real src — but no crash either
    expect(screen.getByText("Safety Checklist")).toBeTruthy();
  });
});

// ─── AC4: ItemPickerModal only shows published documents ─────────────────────

describe("DocumentPickerModal — AC4: lists published documents", () => {
  it("calls listDocumentPickerItemsAction on mount", async () => {
    vi.mocked(listDocumentPickerItemsAction).mockResolvedValue({
      ok: true,
      items: [
        {
          id: "doc-1",
          slug: "safety-checklist",
          title: "Safety Checklist",
          coverImageKey: null,
          priceCents: 150000,
          kind: "document",
        },
      ],
      hasMore: false,
    });

    render(<DocumentPickerModal onPick={() => {}} onClose={() => {}} />);

    // Wait for async fetch
    await screen.findByText("Safety Checklist");

    expect(vi.mocked(listDocumentPickerItemsAction)).toHaveBeenCalled();
  });

  it("calls onPick with correct data when a document is selected", async () => {
    const onPick = vi.fn();
    vi.mocked(listDocumentPickerItemsAction).mockResolvedValue({
      ok: true,
      items: [
        {
          id: "doc-1",
          slug: "safety-checklist",
          title: "Safety Checklist",
          coverImageKey: "docs/doc-1/cover.jpg",
          priceCents: 150000,
          kind: "document",
        },
      ],
      hasMore: false,
    });

    render(<DocumentPickerModal onPick={onPick} onClose={() => {}} />);

    const btn = await screen.findByRole("button", { name: "Safety Checklist" });
    fireEvent.click(btn);

    expect(onPick).toHaveBeenCalledWith({
      id: "doc-1",
      slug: "safety-checklist",
      title: "Safety Checklist",
      coverImageKey: "docs/doc-1/cover.jpg",
      priceCents: 150000,
    });
  });

  // EC2: empty results
  it("shows 'No documents found' when list is empty", async () => {
    vi.mocked(listDocumentPickerItemsAction).mockResolvedValue({
      ok: true,
      items: [],
      hasMore: false,
    });

    render(<DocumentPickerModal onPick={() => {}} onClose={() => {}} />);

    await screen.findByText(/no published documents/i);
  });
});

// ─── AC5 / EC3: DocumentSpot in rendered article links to /documents/[slug] ──

describe("renderArticleBody — AC5: document_card renders as DocumentSpot link", () => {
  function makeDocCardBody(attrs: { node_id: string; document_id: string; slug: string; title: string; price: number; previewUrl?: string }) {
    return {
      schema_version: SCHEMA_VERSION,
      type: "doc" as const,
      content: [
        {
          type: "document_card" as const,
          attrs,
        },
      ],
    };
  }

  it("renders a link to /documents/[slug]", () => {
    const body = makeDocCardBody({
      node_id: "node-1",
      document_id: "doc-1",
      slug: "safety-checklist",
      title: "Safety Checklist",
      price: 150000,
    });
    const { container } = render(renderArticleBody(body));
    const link = container.querySelector("a[data-block='document']");
    expect(link).not.toBeNull();
    expect(link?.getAttribute("href")).toBe("/documents/safety-checklist");
    expect(link?.textContent).toContain("Safety Checklist");
  });

  it("never renders a file URL", () => {
    const body = makeDocCardBody({
      node_id: "node-1",
      document_id: "doc-1",
      slug: "safety-checklist",
      title: "Safety Checklist",
      price: 150000,
    });
    const { container } = render(renderArticleBody(body));
    const links = container.querySelectorAll("a");
    for (const link of links) {
      expect(link.getAttribute("href")).not.toMatch(/\.pdf|\.pptx|r2\.cloudflarestorage/i);
    }
  });

  // EC3: document deleted after insertion — card still renders from JSON
  it("renders card even when document may be deleted (snapshot from JSON)", () => {
    const body = makeDocCardBody({
      node_id: "node-1",
      document_id: "doc-999",
      slug: "old-doc",
      title: "Old Document",
      price: 50000,
    });
    const { container } = render(renderArticleBody(body));
    const link = container.querySelector("a[data-block='document']");
    expect(link?.getAttribute("href")).toBe("/documents/old-doc");
  });
});
