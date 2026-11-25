// S-091: CartItemRow — AC2, AC6
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

vi.mock("@/messages/en", () => ({
  t: (key: string) => key,
  errorMessage: (code: string) => code,
}));

import CartItemRow from "@/components/cart/CartItemRow";
import type { CartLineResult } from "@/types/cart";

const AVAILABLE_ITEM: CartLineResult = {
  cartItemId: "item-1",
  documentId: "doc-1",
  title: "Fire Safety Checklist",
  slug: "fire-safety-checklist",
  coverUrl: null,
  language: "en",
  pageCount: 10,
  price: 149900,
  available: true,
};

const UNAVAILABLE_ITEM: CartLineResult = {
  ...AVAILABLE_ITEM,
  cartItemId: "item-2",
  available: false,
  unavailableReason: "document_unavailable",
};

describe("CartItemRow", () => {
  it("AC2: renders title, language badge, price, and remove button", () => {
    render(<CartItemRow item={AVAILABLE_ITEM} onRemove={vi.fn()} isRemoving={false} />);

    expect(screen.getByText("Fire Safety Checklist")).toBeInTheDocument();
    expect(screen.getByText("EN")).toBeInTheDocument();
    // price formatted: 149900 cents = LKR 1,499.00
    expect(screen.getByText(/1,499/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cart\.item\.remove/ })).toBeInTheDocument();
  });

  it("AC2: shows SI language badge for Sinhala items", () => {
    render(
      <CartItemRow
        item={{ ...AVAILABLE_ITEM, language: "si" }}
        onRemove={vi.fn()}
        isRemoving={false}
      />,
    );
    expect(screen.getByText("SI")).toBeInTheDocument();
  });

  it("AC2: shows TA language badge for Tamil items", () => {
    render(
      <CartItemRow
        item={{ ...AVAILABLE_ITEM, language: "ta" }}
        onRemove={vi.fn()}
        isRemoving={false}
      />,
    );
    expect(screen.getByText("TA")).toBeInTheDocument();
  });

  it("AC6: unavailable item shows Unavailable badge (document_unavailable)", () => {
    render(<CartItemRow item={UNAVAILABLE_ITEM} onRemove={vi.fn()} isRemoving={false} />);
    expect(screen.getByText(/cart\.item\.unavailable/)).toBeInTheDocument();
  });

  it("AC6: unavailable item shows Unavailable badge (language_unavailable)", () => {
    const languageUnavailableItem: CartLineResult = {
      ...AVAILABLE_ITEM,
      cartItemId: "item-3",
      available: false,
      unavailableReason: "language_unavailable",
    };
    render(<CartItemRow item={languageUnavailableItem} onRemove={vi.fn()} isRemoving={false} />);
    expect(screen.getByText(/cart\.item\.unavailable/)).toBeInTheDocument();
  });

  it("remove button calls onRemove with cartItemId", async () => {
    const onRemove = vi.fn();
    render(<CartItemRow item={AVAILABLE_ITEM} onRemove={onRemove} isRemoving={false} />);
    await userEvent.click(screen.getByRole("button", { name: /cart\.item\.remove/ }));
    expect(onRemove).toHaveBeenCalledWith("item-1");
  });

  it("remove button is disabled while isRemoving", () => {
    render(<CartItemRow item={AVAILABLE_ITEM} onRemove={vi.fn()} isRemoving={true} />);
    expect(screen.getByRole("button", { name: /cart\.item\.remove/ })).toBeDisabled();
  });
});
