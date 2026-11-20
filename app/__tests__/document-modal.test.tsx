import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import type { PublicDocument } from "@/types/document";

// jsdom matchMedia stub
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock next/navigation
const mockReplace = vi.fn();
const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ replace: mockReplace, push: mockPush, refresh: mockRefresh })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  usePathname: vi.fn(() => "/documents"),
}));

// Mock the server action
vi.mock("@/app/actions/cart", () => ({
  addToCart: vi.fn(),
}));

// Mock getDocument server action — DocumentModal imports from app/actions/getDocument
vi.mock("@/app/actions/getDocument", () => ({
  getPublicDocument: vi.fn(),
}));

// publicUrl pulls in lib/config.ts which requires server env vars — stub it
vi.mock("@/lib/media/publicUrl", () => ({
  publicUrl: (key: string) => `https://cdn.test/${key}`,
}));

// next/image doesn't render as <img> in jsdom by default
vi.mock("next/image", () => ({
  default: ({ src, alt, ...rest }: { src: string; alt: string; [k: string]: unknown }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} {...(rest as React.ImgHTMLAttributes<HTMLImageElement>)} />
  ),
}));

import DocumentModal from "@/components/documents/DocumentModal";
import { addToCart } from "@/app/actions/cart";
import { getPublicDocument } from "@/app/actions/getDocument";
import { useSearchParams } from "next/navigation";

const mockAddToCart = vi.mocked(addToCart);
const mockGetPublicDocument = vi.mocked(getPublicDocument);
const mockUseSearchParams = vi.mocked(useSearchParams);

const DOC: PublicDocument = {
  id: "doc-1",
  slug: "safety-checklist",
  title: "Safety Checklist",
  coverImageKey: "covers/safety-checklist.jpg",
  priceCents: 150000,
  pageCount: 12,
  downloadCount: 42,
  docKind: "checklist",
  categoryId: "cat-1",
  categoryName: "Construction",
  languages: ["en", "si"],
  unavailable: false,
  description: "A comprehensive safety checklist.",
  previewAvailability: { en: 2, si: 1, ta: 0 },
};

function withSlug(slug: string) {
  mockUseSearchParams.mockReturnValue(new URLSearchParams(`document=${slug}`) as never);
}

function withNoSlug() {
  mockUseSearchParams.mockReturnValue(new URLSearchParams() as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  withNoSlug();
});

// --- AC7: no slug → modal stays closed ---
describe("AC7 / AC8: modal visibility", () => {
  it("does not render modal content when ?document= is absent", () => {
    withNoSlug();
    render(<DocumentModal />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("AC8: does not open modal when getPublicDocument returns not_found", async () => {
    withSlug("deleted-doc");
    mockGetPublicDocument.mockResolvedValueOnce({ ok: false, code: "not_found" });
    render(<DocumentModal />);
    await waitFor(() => expect(mockGetPublicDocument).toHaveBeenCalledWith("deleted-doc"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens modal when ?document=<slug> is present and document found", async () => {
    withSlug("safety-checklist");
    mockGetPublicDocument.mockResolvedValueOnce({ ok: true, document: DOC });
    render(<DocumentModal />);
    await waitFor(() => screen.getByRole("dialog"));
    expect(screen.getByRole("dialog")).toBeDefined();
  });
});

// --- AC1: modal fields ---
describe("AC1: modal shows required fields", () => {
  beforeEach(() => {
    withSlug("safety-checklist");
    mockGetPublicDocument.mockResolvedValue({ ok: true, document: DOC });
  });

  it("shows document title", async () => {
    render(<DocumentModal />);
    await screen.findByText("Safety Checklist");
  });

  it("shows category", async () => {
    render(<DocumentModal />);
    await screen.findByText("Construction");
  });

  it("shows price in LKR", async () => {
    render(<DocumentModal />);
    await screen.findByText(/1,500/); // 150000 cents = LKR 1,500.00
  });

  it("shows description", async () => {
    render(<DocumentModal />);
    await screen.findByText("A comprehensive safety checklist.");
  });

  it("shows cover image", async () => {
    render(<DocumentModal />);
    // Cover is blurred/decorative so alt=""; find by src URL instead
    await waitFor(() => {
      const imgs = document.querySelectorAll('img[src*="safety-checklist"]');
      if (imgs.length === 0) throw new Error("cover image not found");
    });
  });
});

// --- AC2: LanguagePicker ---
describe("AC2: LanguagePicker shows only verified languages", () => {
  it("shows EN and SI buttons (they have files), not TA (previewAvailability has ta:0 but languages has en/si)", async () => {
    withSlug("safety-checklist");
    mockGetPublicDocument.mockResolvedValue({ ok: true, document: DOC });
    render(<DocumentModal />);
    await screen.findByText("Safety Checklist");
    // languages: ["en","si"] — these two are present and enabled
    expect(screen.getByRole("button", { name: /english/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /sinhala/i })).toBeDefined();
    // TA is NOT in languages array so should not be shown as available
    expect(screen.queryByRole("button", { name: /tamil/i })).toBeNull();
  });

  it("pre-selects the first available language", async () => {
    withSlug("safety-checklist");
    mockGetPublicDocument.mockResolvedValue({ ok: true, document: DOC });
    render(<DocumentModal />);
    await screen.findByText("Safety Checklist");
    const enBtn = screen.getByRole("button", { name: /english/i });
    expect(enBtn).toHaveAttribute("aria-pressed", "true");
  });

  it("EC2: shows unavailable state when document has no languages", async () => {
    withSlug("safety-checklist");
    mockGetPublicDocument.mockResolvedValue({
      ok: true,
      document: { ...DOC, languages: [], unavailable: true },
    });
    render(<DocumentModal />);
    await screen.findByText(/unavailable/i);
    // Button label changes to "Unavailable" and is disabled
    expect(screen.getByRole("button", { name: /unavailable/i })).toBeDisabled();
  });
});

// --- AC3: Add to Cart ---
describe("AC3: Add to Cart", () => {
  beforeEach(() => {
    withSlug("safety-checklist");
    mockGetPublicDocument.mockResolvedValue({ ok: true, document: DOC });
  });

  it("calls addToCart with documentId and selected language", async () => {
    mockAddToCart.mockResolvedValueOnce({ ok: true });
    const user = userEvent.setup();
    render(<DocumentModal />);
    await screen.findByText("Safety Checklist");
    await user.click(screen.getByRole("button", { name: /add to cart/i }));
    expect(mockAddToCart).toHaveBeenCalledWith("doc-1", "en");
  });

  it("shows success toast on ok", async () => {
    mockAddToCart.mockResolvedValueOnce({ ok: true });
    const user = userEvent.setup();
    render(<DocumentModal />);
    await screen.findByText("Safety Checklist");
    await user.click(screen.getByRole("button", { name: /add to cart/i }));
    await screen.findByText(/added to cart/i);
  });

  it("calls router.refresh() after success so header cart count updates (AC3)", async () => {
    mockAddToCart.mockResolvedValueOnce({ ok: true });
    const user = userEvent.setup();
    render(<DocumentModal />);
    await screen.findByText("Safety Checklist");
    await user.click(screen.getByRole("button", { name: /add to cart/i }));
    await screen.findByText(/added to cart/i);
    expect(mockRefresh).toHaveBeenCalledOnce();
  });

  it("shows already_in_cart toast", async () => {
    mockAddToCart.mockResolvedValueOnce({ ok: false, code: "already_in_cart" });
    const user = userEvent.setup();
    render(<DocumentModal />);
    await screen.findByText("Safety Checklist");
    await user.click(screen.getByRole("button", { name: /add to cart/i }));
    await screen.findByText(/already in your cart/i);
  });

  it("EC3: shows cart_full toast", async () => {
    mockAddToCart.mockResolvedValueOnce({ ok: false, code: "cart_full" });
    const user = userEvent.setup();
    render(<DocumentModal />);
    await screen.findByText("Safety Checklist");
    await user.click(screen.getByRole("button", { name: /add to cart/i }));
    await screen.findByText(/cart is full/i);
  });

  it("shows document_unavailable inline error", async () => {
    mockAddToCart.mockResolvedValueOnce({ ok: false, code: "document_unavailable" });
    const user = userEvent.setup();
    render(<DocumentModal />);
    await screen.findByText("Safety Checklist");
    await user.click(screen.getByRole("button", { name: /add to cart/i }));
    await screen.findByText(/no longer available/i);
  });
});

// --- AC4: Buy Now ---
describe("AC4: Buy Now", () => {
  beforeEach(() => {
    withSlug("safety-checklist");
    mockGetPublicDocument.mockResolvedValue({ ok: true, document: DOC });
  });

  it("calls addToCart then navigates to /checkout on success", async () => {
    mockAddToCart.mockResolvedValueOnce({ ok: true });
    const user = userEvent.setup();
    render(<DocumentModal />);
    await screen.findByText("Safety Checklist");
    await user.click(screen.getByRole("button", { name: /buy now/i }));
    expect(mockAddToCart).toHaveBeenCalledWith("doc-1", "en");
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/checkout"));
  });

  it("still navigates to /checkout on already_in_cart", async () => {
    mockAddToCart.mockResolvedValueOnce({ ok: false, code: "already_in_cart" });
    const user = userEvent.setup();
    render(<DocumentModal />);
    await screen.findByText("Safety Checklist");
    await user.click(screen.getByRole("button", { name: /buy now/i }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/checkout"));
  });
});

// --- AC5: Unauthenticated redirect ---
describe("AC5: unauthenticated redirect", () => {
  beforeEach(() => {
    withSlug("safety-checklist");
    mockGetPublicDocument.mockResolvedValue({ ok: true, document: DOC });
  });

  it("redirects to sign-in when addToCart returns not_signed_in", async () => {
    mockAddToCart.mockResolvedValueOnce({ ok: false, code: "not_signed_in" });
    const user = userEvent.setup();
    render(<DocumentModal />);
    await screen.findByText("Safety Checklist");
    await user.click(screen.getByRole("button", { name: /add to cart/i }));
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(
        "/sign-in?next=%2Fdocuments%3Fdocument%3Dsafety-checklist",
      ),
    );
  });

  it("Buy Now: redirects to sign-in when addToCart returns not_signed_in", async () => {
    mockAddToCart.mockResolvedValueOnce({ ok: false, code: "not_signed_in" });
    const user = userEvent.setup();
    render(<DocumentModal />);
    await screen.findByText("Safety Checklist");
    await user.click(screen.getByRole("button", { name: /buy now/i }));
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(
        "/sign-in?next=%2Fdocuments%3Fdocument%3Dsafety-checklist",
      ),
    );
  });
});

// --- AC6: Close modal ---
describe("AC6: closing modal", () => {
  it("calls router.replace to remove ?document= param on close", async () => {
    withSlug("safety-checklist");
    mockGetPublicDocument.mockResolvedValue({ ok: true, document: DOC });
    const user = userEvent.setup();
    render(<DocumentModal />);
    await screen.findByText("Safety Checklist");
    await user.click(screen.getByRole("button", { name: /close/i }));
    expect(mockReplace).toHaveBeenCalledWith("/documents", { scroll: false });
  });

  it("does NOT close modal on Escape key", async () => {
    withSlug("safety-checklist");
    mockGetPublicDocument.mockResolvedValue({ ok: true, document: DOC });
    render(<DocumentModal />);
    await screen.findByRole("dialog");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("does NOT close modal on backdrop click", async () => {
    withSlug("safety-checklist");
    mockGetPublicDocument.mockResolvedValue({ ok: true, document: DOC });
    const user = userEvent.setup();
    render(<DocumentModal />);
    await screen.findByRole("dialog");
    const backdrop = screen.getByTestId("modal-backdrop");
    await user.click(backdrop);
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

// --- EC1: No preview images ---
describe("EC1: no preview images", () => {
  it("shows placeholder when coverImageKey is null", async () => {
    withSlug("safety-checklist");
    mockGetPublicDocument.mockResolvedValue({
      ok: true,
      document: { ...DOC, coverImageKey: null },
    });
    render(<DocumentModal />);
    await screen.findByText("Safety Checklist");
    // Should show placeholder, not broken image
    expect(screen.queryByRole("img", { name: /Safety Checklist/i })).toBeNull();
    expect(screen.getByTestId("locked-preview-placeholder")).toBeDefined();
  });
});

// --- EC4: Only one modal at a time ---
describe("EC4: only one modal shown at a time", () => {
  it("a single DocumentModal mount renders exactly one dialog", async () => {
    withSlug("safety-checklist");
    mockGetPublicDocument.mockResolvedValue({ ok: true, document: DOC });
    // The page (documents/page.tsx) mounts exactly one DocumentModal instance.
    // This test mirrors that: one mount → one dialog in the DOM.
    render(<DocumentModal />);
    await waitFor(() => screen.getByRole("dialog"));
    const dialogs = screen.getAllByRole("dialog");
    expect(dialogs.length).toBe(1);
  });
});

// --- docKind badge, page count, download count stats ---
describe("document stats and kind badge", () => {
  beforeEach(() => {
    withSlug("safety-checklist");
    mockGetPublicDocument.mockResolvedValue({ ok: true, document: DOC });
  });

  it("shows the docKind label from messages", async () => {
    render(<DocumentModal />);
    await screen.findByText("Checklist");
  });

  it("shows page count stat when pageCount > 0", async () => {
    render(<DocumentModal />);
    await screen.findByText(/12 pages/i);
  });

  it("hides page count stat when pageCount is null", async () => {
    withSlug("safety-checklist");
    mockGetPublicDocument.mockResolvedValue({
      ok: true,
      document: { ...DOC, pageCount: null },
    });
    render(<DocumentModal />);
    await screen.findByText("Safety Checklist");
    expect(screen.queryByText(/pages/i)).toBeNull();
  });

  it("hides page count stat when pageCount is 0", async () => {
    withSlug("safety-checklist");
    mockGetPublicDocument.mockResolvedValue({
      ok: true,
      document: { ...DOC, pageCount: 0 },
    });
    render(<DocumentModal />);
    await screen.findByText("Safety Checklist");
    expect(screen.queryByText(/pages/i)).toBeNull();
  });

  it("shows download count stat when downloadCount > 0", async () => {
    render(<DocumentModal />);
    await screen.findByText(/42 downloads/i);
  });

  it("hides download count stat when downloadCount is 0", async () => {
    withSlug("safety-checklist");
    mockGetPublicDocument.mockResolvedValue({
      ok: true,
      document: { ...DOC, downloadCount: 0 },
    });
    render(<DocumentModal />);
    await screen.findByText("Safety Checklist");
    expect(screen.queryByText(/downloads/i)).toBeNull();
  });

  it("shows correct kind label for safety_sign", async () => {
    withSlug("safety-checklist");
    mockGetPublicDocument.mockResolvedValue({
      ok: true,
      document: { ...DOC, docKind: "safety_sign" },
    });
    render(<DocumentModal />);
    await screen.findByText("Safety Sign");
  });

  it("shows correct kind label for toolbox_talk", async () => {
    withSlug("safety-checklist");
    mockGetPublicDocument.mockResolvedValue({
      ok: true,
      document: { ...DOC, docKind: "toolbox_talk" },
    });
    render(<DocumentModal />);
    await screen.findByText("Toolbox Talk");
  });
});

// --- AC6 (skeleton): loading skeleton backdrop does not close modal ---
describe("AC6 (skeleton): backdrop click during loading does not close", () => {
  it("does NOT close modal on backdrop click while document is loading", async () => {
    withSlug("safety-checklist");
    // Keep the fetch in-flight so the loading skeleton stays visible
    mockGetPublicDocument.mockReturnValueOnce(new Promise(() => {}));
    const user = userEvent.setup();
    render(<DocumentModal />);
    // Skeleton dialog should be present
    await screen.findByRole("dialog");
    const backdrop = screen.getByTestId("modal-backdrop");
    await user.click(backdrop);
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

// --- EC5: Mobile layout ---
describe("EC5: mobile layout classes", () => {
  it("modal panel has overflow-y-auto and max-h-[90vh] for mobile scroll", async () => {
    withSlug("safety-checklist");
    mockGetPublicDocument.mockResolvedValue({ ok: true, document: DOC });
    render(<DocumentModal />);
    await screen.findByRole("dialog");
    // The panel (direct child inside the dialog) must carry the scroll/height classes.
    // jsdom cannot compute actual scroll behaviour, so we assert the structural classes.
    const dialog = screen.getByRole("dialog");
    const panel = dialog.querySelector(".overflow-y-auto");
    expect(panel).not.toBeNull();
    expect(panel?.className).toMatch(/max-h-\[90vh\]/);
    // Full-width at all sizes
    expect(panel?.className).toMatch(/w-full/);
  });
});

// --- EC6: Loading state / double-click prevention ---
describe("EC6: loading state", () => {
  it("disables Add to Cart button while request is in flight", async () => {
    withSlug("safety-checklist");
    mockGetPublicDocument.mockResolvedValue({ ok: true, document: DOC });
    let resolve!: (v: { ok: true }) => void;
    mockAddToCart.mockReturnValueOnce(new Promise((res) => (resolve = res)));
    const user = userEvent.setup();
    render(<DocumentModal />);
    await screen.findByText("Safety Checklist");
    const btn = screen.getByRole("button", { name: /add to cart/i });
    await user.click(btn);
    expect(btn).toBeDisabled();
    resolve({ ok: true });
    await waitFor(() => expect(btn).not.toBeDisabled());
  });

  it("disables Buy Now button while request is in flight", async () => {
    withSlug("safety-checklist");
    mockGetPublicDocument.mockResolvedValue({ ok: true, document: DOC });
    let resolve!: (v: { ok: true }) => void;
    mockAddToCart.mockReturnValueOnce(new Promise((res) => (resolve = res)));
    const user = userEvent.setup();
    render(<DocumentModal />);
    await screen.findByText("Safety Checklist");
    const btn = screen.getByRole("button", { name: /buy now/i });
    await user.click(btn);
    // Button is disabled while the addToCart call is in-flight
    expect(btn).toBeDisabled();
    // Resolve — Buy Now navigates away on success, so we just verify the
    // in-flight guard fired (button was disabled during the request)
    resolve({ ok: true });
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/checkout"));
  });
});

// --- AC7: loading skeleton on direct-link / slow network ---
describe("AC7: loading skeleton", () => {
  beforeEach(() => {
    mockReplace.mockReset();
    mockPush.mockReset();
    mockRefresh.mockReset();
  });

  it("shows loading state while document fetch is in-flight", async () => {
    withSlug("safety-checklist");
    let resolve!: (v: { ok: true; document: PublicDocument }) => void;
    mockGetPublicDocument.mockReturnValueOnce(new Promise((res) => (resolve = res)));
    render(<DocumentModal />);
    // Loading skeleton renders before the fetch resolves
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByText("Safety Checklist")).toBeNull();
    // Resolve — full modal replaces the skeleton
    resolve({ ok: true, document: DOC });
    await screen.findByText("Safety Checklist");
  });

  it("clears loading state and hides modal when getPublicDocument rejects", async () => {
    withSlug("safety-checklist");
    mockGetPublicDocument.mockReturnValueOnce(Promise.reject(new Error("network error")));
    render(<DocumentModal />);
    // Modal disappears after the rejection resolves (loading→false, doc→null → returns null)
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
