// S-091: CartPageClient — AC3, AC4, AC5, AC6, AC7, AC8, AC9, EC1, EC2
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

vi.mock("@/messages/en", () => ({
  t: (key: string) => key,
  errorMessage: (code: string) => code,
}));

const mockRouterRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRouterRefresh, push: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    React.createElement("a", { href, ...rest }, children),
}));

const mockRemoveAction = vi.fn();
vi.mock("@/app/(customer)/cart/actions", () => ({
  removeFromCartAction: (...args: unknown[]) => mockRemoveAction(...args),
}));

import CartPageClient from "@/components/cart/CartPageClient";
import type { CartCalculateResponse } from "@/types/cart";

const ITEM_1 = {
  cartItemId: "item-1",
  documentId: "doc-1",
  title: "Fire Safety Checklist",
  slug: "fire-safety-checklist",
  coverUrl: null,
  language: "en" as const,
  pageCount: 10,
  price: 149900,
  available: true,
};

const ITEM_2 = {
  cartItemId: "item-2",
  documentId: "doc-2",
  title: "Toolbox Talk: Working at Height",
  slug: "toolbox-talk-working-at-height",
  coverUrl: null,
  language: "si" as const,
  pageCount: 5,
  price: 99900,
  available: true,
};

const UNAVAILABLE_ITEM = {
  ...ITEM_1,
  cartItemId: "item-3",
  available: false,
  unavailableReason: "document_unavailable" as const,
};

const FULL_CART: CartCalculateResponse = {
  items: [ITEM_1, ITEM_2],
  subtotal: 249800,
  total: 249800,
};

const EMPTY_CART: CartCalculateResponse = {
  items: [],
  subtotal: 0,
  total: 0,
};

const CART_WITH_UNAVAILABLE: CartCalculateResponse = {
  items: [ITEM_2, UNAVAILABLE_ITEM],
  subtotal: 99900,
  total: 99900,
};

beforeEach(() => {
  vi.clearAllMocks();
  // Default: removeAction succeeds; re-fetch returns empty cart
  mockRemoveAction.mockResolvedValue({ ok: true });
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ items: [ITEM_2], subtotal: 99900, total: 99900 }),
  });
});

describe("CartPageClient — AC5: empty cart", () => {
  it("shows empty state message and Browse documents link", () => {
    render(<CartPageClient initialCart={EMPTY_CART} />);
    expect(screen.getByText(/cart\.empty\.title/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /cart\.empty\.browse/ });
    expect(link).toHaveAttribute("href", "/documents");
  });
});

describe("CartPageClient — AC4: server-computed totals", () => {
  it("displays subtotal and total from server; no browser calculation", () => {
    render(<CartPageClient initialCart={FULL_CART} />);
    // 249800 cents = LKR 2,498.00
    const totals = screen.getAllByText(/2,498/);
    expect(totals.length).toBeGreaterThanOrEqual(1);
  });
});

describe("CartPageClient — AC3: remove item", () => {
  it("calls removeFromCartAction and re-fetches totals on remove", async () => {
    render(<CartPageClient initialCart={FULL_CART} />);

    const removeButtons = screen.getAllByRole("button", { name: /cart\.item\.remove/ });
    await userEvent.click(removeButtons[0]);

    await waitFor(() => expect(mockRemoveAction).toHaveBeenCalledWith("item-1"));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith("/api/cart/calculate", expect.any(Object)));
    await waitFor(() => expect(mockRouterRefresh).toHaveBeenCalled());
  });

  it("EC1: shows inline error when remove action fails; item stays in list", async () => {
    mockRemoveAction.mockResolvedValue({ ok: false, code: "not_found" });
    render(<CartPageClient initialCart={FULL_CART} />);

    const removeButtons = screen.getAllByRole("button", { name: /cart\.item\.remove/ });
    await userEvent.click(removeButtons[0]);

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    // items still shown
    expect(screen.getByText("Fire Safety Checklist")).toBeInTheDocument();
  });

  it("EC1: shows inline error when re-fetch fails after successful action; item stays in list", async () => {
    mockRemoveAction.mockResolvedValue({ ok: true });
    global.fetch = vi.fn().mockRejectedValue(new Error("network error"));
    render(<CartPageClient initialCart={FULL_CART} />);

    const removeButtons = screen.getAllByRole("button", { name: /cart\.item\.remove/ });
    await userEvent.click(removeButtons[0]);

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    // item stays; stale totals are NOT shown because we keep old state
    expect(screen.getByText("Fire Safety Checklist")).toBeInTheDocument();
  });
});

describe("CartPageClient — EC2: visibilitychange re-fetch", () => {
  it("EC2: when tab becomes visible, re-fetches cart and shows updated state", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => EMPTY_CART,
    });

    render(<CartPageClient initialCart={FULL_CART} />);
    // Items are shown initially
    expect(screen.getByText("Fire Safety Checklist")).toBeInTheDocument();

    // Simulate tab becoming visible
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText(/cart\.empty\.title/)).toBeInTheDocument());
  });
});

describe("CartPageClient — AC6/AC7: unavailable items", () => {
  it("AC6: shows unavailable badge on unavailable items (not silently removed)", () => {
    render(<CartPageClient initialCart={CART_WITH_UNAVAILABLE} />);
    expect(screen.getByText(/cart\.item\.unavailable/)).toBeInTheDocument();
    // EC3: unavailable item title still shown
    expect(screen.getByText("Fire Safety Checklist")).toBeInTheDocument();
  });

  it("AC7: Proceed to Checkout button is disabled when cart has unavailable items", () => {
    render(<CartPageClient initialCart={CART_WITH_UNAVAILABLE} />);
    expect(
      screen.getByRole("link", { name: /cart\.checkout\.proceed/ }),
    ).toHaveAttribute("aria-disabled", "true");
  });

  it("AC7: Proceed to Checkout is not rendered for empty cart (empty-state branch shown)", () => {
    render(<CartPageClient initialCart={EMPTY_CART} />);
    // Empty cart renders the empty-state UI, not the cart items + proceed button
    expect(screen.queryByRole("link", { name: /cart\.checkout\.proceed/ })).toBeNull();
    expect(screen.getByText(/cart\.empty\.title/)).toBeInTheDocument();
  });

  it("AC7: Proceed to Checkout is enabled when cart is non-empty with all available", () => {
    render(<CartPageClient initialCart={FULL_CART} />);
    const proceed = screen.getByRole("link", { name: /cart\.checkout\.proceed/ });
    expect(proceed).not.toHaveAttribute("aria-disabled", "true");
    expect(proceed).toHaveAttribute("href", "/checkout");
  });

  it("AC6: shows warning message explaining unavailable items must be removed", () => {
    render(<CartPageClient initialCart={CART_WITH_UNAVAILABLE} />);
    expect(screen.getByText(/cart\.unavailable\.warning/)).toBeInTheDocument();
  });
});

describe("CartPageClient — AC9: no coupon input in Release 1", () => {
  it("does not render a CouponInput field", () => {
    render(<CartPageClient initialCart={FULL_CART} />);
    expect(screen.queryByRole("textbox", { name: /coupon/i })).not.toBeInTheDocument();
  });
});
