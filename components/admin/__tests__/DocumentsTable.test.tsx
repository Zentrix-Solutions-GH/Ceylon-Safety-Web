// S-072: AC1, AC2, EC6 — DocumentsTable component
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import * as React from "react";
import type { AdminDocumentRow } from "@/types/document";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/admin/documents",
}));

function makeRow(overrides: Partial<AdminDocumentRow> = {}): AdminDocumentRow {
  return {
    id: "doc-1",
    title: "Fire Safety Checklist",
    slug: "fire-safety-checklist",
    docKind: "checklist",
    categoryId: "cat-1",
    categoryName: "Fire Safety",
    priceCents: 150000,
    status: "draft",
    languageSlots: [
      { language: "en", full: "ready", previews: ["ready", "missing", "missing"] },
      { language: "si", full: "missing", previews: ["missing", "missing", "missing"] },
      { language: "ta", full: "uploading", previews: ["missing", "missing", "missing"] },
    ],
    updatedAt: "2026-11-01T10:00:00Z",
    createdAt: "2026-11-01T09:00:00Z",
    ...overrides,
  };
}

// ─── AC1: list rendering ──────────────────────────────────────────────────────

describe("AC1: DocumentsTable renders document rows", () => {
  it("renders title, type, category, price in LKR, status, language marks, last changed", async () => {
    const { DocumentsTable } = await import("@/components/admin/DocumentsTable");
    render(<DocumentsTable rows={[makeRow()]} />);

    expect(screen.getByText("Fire Safety Checklist")).toBeInTheDocument();
    expect(screen.getByText("Checklist")).toBeInTheDocument();
    expect(screen.getByText("Fire Safety")).toBeInTheDocument();
    // Price: 150000 cents = 1500.00 LKR
    expect(screen.getByText(/1,500\.00/)).toBeInTheDocument();
    expect(screen.getByText(/draft/i)).toBeInTheDocument();
    // Language marks: EN ready, SI missing, TA uploading
    expect(screen.getByTitle("EN: ready")).toBeInTheDocument();
    expect(screen.getByTitle("SI: missing")).toBeInTheDocument();
    expect(screen.getByTitle("TA: uploading")).toBeInTheDocument();
  });

  it("renders an edit link for each row", async () => {
    const { DocumentsTable } = await import("@/components/admin/DocumentsTable");
    render(<DocumentsTable rows={[makeRow()]} />);
    expect(screen.getByRole("link", { name: /edit/i })).toHaveAttribute(
      "href",
      "/admin/documents/doc-1/edit"
    );
  });

  it("renders published status correctly", async () => {
    const { DocumentsTable } = await import("@/components/admin/DocumentsTable");
    render(<DocumentsTable rows={[makeRow({ status: "published" })]} />);
    expect(screen.getByText(/published/i)).toBeInTheDocument();
  });
});

// ─── AC2: empty state ─────────────────────────────────────────────────────────

describe("AC2: DocumentsTable empty state", () => {
  it("shows exact empty message and add button when rows is empty", async () => {
    const { DocumentsTable } = await import("@/components/admin/DocumentsTable");
    render(<DocumentsTable rows={[]} />);
    expect(
      screen.getByText("No documents yet. Add the first one.")
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /add/i })).toHaveAttribute(
      "href",
      "/admin/documents/new"
    );
  });
});

// ─── EC6: horizontal scroll ───────────────────────────────────────────────────

describe("EC6: table is wrapped in scrollable container", () => {
  it("wraps the table in overflow-x-auto so the page does not scroll sideways", async () => {
    const { DocumentsTable } = await import("@/components/admin/DocumentsTable");
    const { container } = render(<DocumentsTable rows={[makeRow()]} />);
    // The outermost div must have overflow-x-auto (from DataTable convention)
    expect(container.querySelector(".overflow-x-auto")).not.toBeNull();
  });
});
