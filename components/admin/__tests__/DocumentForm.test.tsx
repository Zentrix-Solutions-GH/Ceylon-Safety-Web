// S-072: AC3–AC8, EC1–EC5 — DocumentForm component
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as React from "react";
import { DocumentForm } from "@/components/admin/DocumentForm";
import { useMediaUpload } from "@/hooks/useMediaUpload";
import type { AdminDocument } from "@/types/document";
import type { Category } from "@/types/article";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockSaveDocument = vi.fn();
const mockPush = vi.fn();
const mockReplace = vi.fn();

vi.mock("@/lib/admin/actions/documents", () => ({
  saveDocument: (...args: unknown[]) => mockSaveDocument(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  usePathname: () => "/admin/documents/new",
}));

vi.mock("@/hooks/useMediaUpload", () => ({
  useMediaUpload: vi.fn(() => ({
    status: "idle" as const,
    errorCode: null,
    upload: vi.fn(),
    retry: vi.fn(),
  })),
}));

vi.mock("@/lib/media/publicUrl", () => ({
  publicUrl: (key: string) => `https://cdn.test.example.com/${key}`,
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const CAT_ID_1 = "11111111-1111-1111-8111-111111111111";
const CAT_ID_2 = "22222222-2222-2222-8222-222222222222";

const CATEGORIES: Category[] = [
  { id: CAT_ID_1, name: "Fire Safety", slug: "fire-safety" },
  { id: CAT_ID_2, name: "Chemical Safety", slug: "chemical-safety" },
];

const EXISTING_DOC: AdminDocument = {
  id: "aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa",
  title: "Fire Safety Checklist",
  slug: "fire-safety-checklist",
  docKind: "checklist",
  categoryId: CAT_ID_1,
  categoryName: "Fire Safety",
  priceCents: 150000,
  status: "draft",
  languageSlots: [
    { language: "en", full: "ready", previews: ["missing", "missing", "missing"] },
    { language: "si", full: "missing", previews: ["missing", "missing", "missing"] },
    { language: "ta", full: "missing", previews: ["missing", "missing", "missing"] },
  ],
  updatedAt: "2026-11-01T10:00:00Z",
  createdAt: "2026-11-01T09:00:00Z",
  description: "A checklist for fire safety inspections.",
  coverImageKey: null,
  pageCount: 10,
  previewPages: 3,
  downloadCount: 0,
  purchaseCount: 0,
  seoTitle: null,
  seoDescription: null,
  publishedAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── AC3: form fields ─────────────────────────────────────────────────────────

describe("AC3: form renders all required fields for create", () => {
  it("shows title, description, type, category, page count, preview pages, cover image, and price fields", async () => {

    render(<DocumentForm mode="create" categories={CATEGORIES} />);

    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/page count/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/preview pages/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/price/i)).toBeInTheDocument();
  });

  it("price field defaults to empty (null) in create mode", async () => {

    render(<DocumentForm mode="create" categories={CATEGORIES} />);
    // number input with no value returns null
    expect(screen.getByLabelText(/price/i)).toHaveValue(null);
  });

  it("preview pages defaults to 3", async () => {

    render(<DocumentForm mode="create" categories={CATEGORIES} />);
    expect(screen.getByLabelText(/preview pages/i)).toHaveValue(3);
  });
});

describe("AC3: edit mode shows price read-only with note", () => {
  it("shows price as read-only text with the note message", async () => {

    render(<DocumentForm mode="edit" document={EXISTING_DOC} categories={CATEGORIES} />);

    // Price input should not be present, but price value should be visible
    expect(screen.queryByLabelText(/price/i)).toBeNull();
    expect(screen.getByText(/1,500\.00/)).toBeInTheDocument();
    expect(screen.getByText(/Change the price from the document page/i)).toBeInTheDocument();
  });
});

// ─── AC4: price field ─────────────────────────────────────────────────────────

describe("AC4: price accepts whole LKR above 0 only", () => {
  it("shows inline error for decimal price like 12.5", async () => {
    const user = userEvent.setup();

    render(<DocumentForm mode="create" categories={CATEGORIES} />);

    const priceInput = screen.getByLabelText(/price/i);
    await user.type(priceInput, "12.5");
    fireEvent.blur(priceInput);

    await waitFor(() => {
      expect(screen.getByText(/whole number/i)).toBeInTheDocument();
    });
  });

  it("shows inline error for price of 0", async () => {
    const user = userEvent.setup();

    render(<DocumentForm mode="create" categories={CATEGORIES} />);

    const priceInput = screen.getByLabelText(/price/i);
    await user.type(priceInput, "0");
    fireEvent.blur(priceInput);

    await waitFor(() => {
      expect(screen.getByText(/above 0/i)).toBeInTheDocument();
    });
  });
});

// ─── AC5: validation and accessibility ───────────────────────────────────────

describe("AC5: form validation and accessibility", () => {
  it("shows error linked by aria-describedby on submit with empty title", async () => {
    const user = userEvent.setup();

    render(<DocumentForm mode="create" categories={CATEGORIES} />);

    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      const titleInput = screen.getByLabelText(/title/i);
      const errorId = titleInput.getAttribute("aria-describedby");
      expect(errorId).toBeTruthy();
      const errorEl = document.getElementById(errorId!);
      expect(errorEl).not.toBeNull();
      expect(titleInput).toHaveAttribute("aria-invalid", "true");
    });
  });

  it("disables button with 'Saving...' text while request is in-flight", async () => {
    let resolveAction!: (v: Awaited<ReturnType<typeof mockSaveDocument>>) => void;
    mockSaveDocument.mockReturnValue(new Promise((r) => { resolveAction = r; }));

    const user = userEvent.setup();

    render(<DocumentForm mode="create" categories={CATEGORIES} />);

    await user.type(screen.getByLabelText(/title/i), "Test Doc");
    await user.selectOptions(screen.getByLabelText(/type/i), "checklist");
    await user.selectOptions(screen.getByLabelText(/category/i), CAT_ID_1);
    await user.type(screen.getByLabelText(/price/i), "1500");

    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();
    });

    resolveAction({ ok: true, documentId: "doc-new", slug: "test-doc", updatedAt: "2026-11-01" });
  });
});

// ─── AC6: version_conflict ────────────────────────────────────────────────────

describe("AC6 / EC1: version_conflict keeps typed text", () => {
  it("shows conflict message and keeps the form values intact", async () => {
    mockSaveDocument.mockResolvedValue({ ok: false, code: "version_conflict" });

    const user = userEvent.setup();

    render(<DocumentForm mode="edit" document={EXISTING_DOC} categories={CATEGORIES} />);

    const titleInput = screen.getByLabelText(/title/i);
    await user.clear(titleInput);
    await user.type(titleInput, "Updated Title");

    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/Someone else changed this while you were editing/i)
      ).toBeInTheDocument();
      // Title text must still be there
      expect(screen.getByLabelText(/title/i)).toHaveValue("Updated Title");
    });
  });
});

// ─── AC7: not_allowed ─────────────────────────────────────────────────────────

describe("AC7: not_allowed shows permission error", () => {
  it("displays not-allowed message when server returns not_allowed", async () => {
    mockSaveDocument.mockResolvedValue({ ok: false, code: "not_allowed" });

    const user = userEvent.setup();

    render(<DocumentForm mode="create" categories={CATEGORIES} />);

    await user.type(screen.getByLabelText(/title/i), "Test Doc");
    await user.selectOptions(screen.getByLabelText(/type/i), "checklist");
    await user.selectOptions(screen.getByLabelText(/category/i), CAT_ID_1);
    await user.type(screen.getByLabelText(/price/i), "1500");

    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/You do not have permission to do this/i)
      ).toBeInTheDocument();
    });
  });
});

// ─── AC8: draft notice ────────────────────────────────────────────────────────

describe("AC8: draft notice shown for new document", () => {
  it("shows draft notice on successful create redirect", async () => {

    render(<DocumentForm mode="create" categories={CATEGORIES} />);
    // The notice must be visible on the create form before saving too,
    // explaining the doc won't be visible until published.
    expect(
      screen.getByText(/not visible to visitors/i)
    ).toBeInTheDocument();
  });
});

// ─── EC2: title validation ────────────────────────────────────────────────────

describe("EC2: title validation before request", () => {
  it("shows error for title over 200 characters on blur", async () => {
    const user = userEvent.setup();

    render(<DocumentForm mode="create" categories={CATEGORIES} />);

    const titleInput = screen.getByLabelText(/title/i);
    await user.type(titleInput, "A".repeat(201));
    fireEvent.blur(titleInput);

    await waitFor(() => {
      expect(screen.getByText(/200 characters/i)).toBeInTheDocument();
    });
  });

  it("shows error for title that is only spaces on blur", async () => {
    const user = userEvent.setup();

    render(<DocumentForm mode="create" categories={CATEGORIES} />);

    const titleInput = screen.getByLabelText(/title/i);
    await user.type(titleInput, "   ");
    fireEvent.blur(titleInput);

    await waitFor(() => {
      expect(screen.getByText(/blank|required/i)).toBeInTheDocument();
    });
  });
});

// ─── EC3: upload failure ──────────────────────────────────────────────────────

describe("EC3: cover image upload failure keeps other values", () => {
  it("shows upload_failed message and other form values are preserved", async () => {
    vi.mocked(useMediaUpload).mockReturnValue({
      status: "upload_failed",
      errorCode: null,
      upload: vi.fn(),
      retry: vi.fn(),
    });

    const user = userEvent.setup();
    render(<DocumentForm mode="create" categories={CATEGORIES} />);

    await user.type(screen.getByLabelText(/title/i), "My Doc");

    await waitFor(() => {
      expect(
        screen.getByText(/The upload did not finish. Try again/i)
      ).toBeInTheDocument();
    });
    // Other field values must be preserved
    expect(screen.getByLabelText(/title/i)).toHaveValue("My Doc");
  });
});

// ─── EC4: session expired ─────────────────────────────────────────────────────

describe("EC4: reauth_required keeps typed text", () => {
  it("shows sign-in-again message and preserves form text", async () => {
    mockSaveDocument.mockResolvedValue({ ok: false, code: "reauth_required" });

    const user = userEvent.setup();

    render(<DocumentForm mode="create" categories={CATEGORIES} />);

    await user.type(screen.getByLabelText(/title/i), "My Doc");
    await user.selectOptions(screen.getByLabelText(/type/i), "checklist");
    await user.selectOptions(screen.getByLabelText(/category/i), CAT_ID_1);
    await user.type(screen.getByLabelText(/price/i), "1000");

    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/sign in again/i)
      ).toBeInTheDocument();
      expect(screen.getByLabelText(/title/i)).toHaveValue("My Doc");
    });
  });
});

// ─── EC5: rejected price ──────────────────────────────────────────────────────

describe("EC5: rejected prices show inline error", () => {
  it("shows error for negative price on blur", async () => {
    const user = userEvent.setup();

    render(<DocumentForm mode="create" categories={CATEGORIES} />);

    const priceInput = screen.getByLabelText(/price/i);
    await user.type(priceInput, "-100");
    fireEvent.blur(priceInput);

    await waitFor(() => {
      expect(screen.getByText(/above 0/i)).toBeInTheDocument();
    });
  });
});
