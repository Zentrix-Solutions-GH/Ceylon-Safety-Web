// S-091: CartPage RSC — AC1 auth guard
import React from "react";
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (url: string) => { mockRedirect(url); throw new Error("NEXT_REDIRECT"); },
}));

const mockCalculateCart = vi.fn();
vi.mock("@/lib/cart/calculate", () => ({
  calculateCart: (userId: string) => mockCalculateCart(userId),
}));

const mockRequireActiveAccount = vi.fn();
vi.mock("@/lib/auth/server", () => ({
  requireActiveAccount: () => mockRequireActiveAccount(),
}));

import CartPage from "@/app/(customer)/cart/page";

describe("CartPage — AC1: auth guard", () => {
  it("redirects unauthenticated visitor to /sign-in?next=/cart", async () => {
    mockRequireActiveAccount.mockResolvedValue({ ok: false, code: "not_authenticated" });

    await expect(CartPage()).rejects.toThrow("NEXT_REDIRECT");

    expect(mockRedirect).toHaveBeenCalledWith("/sign-in?next=/cart");
    expect(mockCalculateCart).not.toHaveBeenCalled();
  });

  it("renders CartPageClient for authenticated user with calculated cart", async () => {
    const mockCart = { items: [{ documentId: "d1", language: "EN", title: "Test", price: 500, available: true, cartItemId: "ci-1" }], subtotal: 500, total: 500 };
    mockRequireActiveAccount.mockResolvedValue({ ok: true, user: { id: "user-1" } });
    mockCalculateCart.mockResolvedValue(mockCart);

    const result = await CartPage();

    expect(mockCalculateCart).toHaveBeenCalledWith("user-1");
    // Result must be a React element whose initialCart prop carries server-computed totals
    expect(result).not.toBeNull();
    expect((result as React.ReactElement).props.initialCart).toEqual(mockCart);
  });
});
