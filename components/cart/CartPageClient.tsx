"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { t } from "@/messages/en";
import { removeFromCartAction } from "@/app/(customer)/cart/actions";
import CartItemRow from "@/components/cart/CartItemRow";
import type { CartCalculateResponse } from "@/types/cart";
import { formatPrice } from "@/components/cart/format-price";

const CART_CALCULATE_URL = "/api/cart/calculate";

interface CartPageClientProps {
  initialCart: CartCalculateResponse;
}

export default function CartPageClient({ initialCart }: CartPageClientProps) {
  const router = useRouter();
  const [cart, setCart] = useState<CartCalculateResponse>(initialCart);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [staleData, setStaleData] = useState(false);

  const hasUnavailable = cart.items.some((item) => !item.available);
  const isEmpty = cart.items.length === 0;
  const canCheckout = !isEmpty && !hasUnavailable;

  // EC2: when the tab regains focus, re-fetch the cart in case another tab made changes
  const refetch = useCallback(async () => {
    try {
      const res = await fetch(CART_CALCULATE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const updated: CartCalculateResponse = await res.json();
        setCart(updated);
        setStaleData(false);
        setRemoveError(null);
        router.refresh();
      } else {
        // Non-ok response (e.g. 429, 500) — keep existing items but flag stale totals
        setStaleData(true);
      }
    } catch {
      // Network failure — flag stale totals so the user knows prices may be outdated
      setStaleData(true);
    }
  }, [router]);

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        refetch();
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [refetch]);

  async function handleRemove(cartItemId: string) {
    setRemovingId(cartItemId);
    setRemoveError(null);
    setStaleData(false);

    const result = await removeFromCartAction(cartItemId);

    if (!result.ok) {
      setRemoveError(t("cart.error.remove_failed"));
      setRemovingId(null);
      return;
    }

    // Re-fetch totals from server (AC3/AC4: prices never computed in browser)
    try {
      const res = await fetch(CART_CALCULATE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const updated: CartCalculateResponse = await res.json();
        setCart(updated);
      } else {
        // Server error — keep old state; show error so item stays visible (AC3/EC1)
        setRemoveError(t("cart.error.remove_failed"));
        setRemovingId(null);
        return;
      }
    } catch {
      // Network failure — keep old state; never show stale totals (AC4)
      setRemoveError(t("cart.error.remove_failed"));
      setRemovingId(null);
      return;
    }

    try {
      router.refresh(); // AC8: revalidate server components so header cart count updates
    } finally {
      setRemovingId(null);
    }
  }

  if (isEmpty) {
    return (
      <div className="container max-w-2xl py-16 px-4 text-center">
        <p className="text-lg font-medium mb-4">{t("cart.empty.title")}</p>
        <Link href="/documents" className="text-primary underline hover:no-underline">
          {t("cart.empty.browse")}
        </Link>
      </div>
    );
  }

  return (
    <div className="container max-w-3xl py-10 px-4">
      <h1 className="text-2xl font-bold mb-6">{t("cart.page_title")}</h1>

      {removeError && (
        <div role="alert" className="mb-4 text-sm text-destructive bg-destructive/10 rounded p-3">
          {removeError}
        </div>
      )}

      {staleData && (
        <div role="status" className="mb-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">
          {t("cart.error.stale_totals")}
        </div>
      )}

      {hasUnavailable && (
        <div className="mb-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">
          {t("cart.unavailable.warning")}
        </div>
      )}

      <div className="border rounded-lg px-4 mb-6">
        {cart.items.map((item) => (
          <CartItemRow
            key={item.cartItemId ?? `${item.documentId}-${item.language}`}
            item={item}
            onRemove={handleRemove}
            isRemoving={removingId === item.cartItemId}
          />
        ))}
      </div>

      {/* AC4: server-computed totals only */}
      <div className="flex flex-col gap-1 items-end text-sm mb-6">
        <div className="flex gap-8">
          <span className="text-muted-foreground">{t("cart.summary.subtotal")}</span>
          <span>LKR {formatPrice(cart.subtotal)}</span>
        </div>
        <div className="flex gap-8 font-semibold text-base">
          <span>{t("cart.summary.total")}</span>
          <span>LKR {formatPrice(cart.total)}</span>
        </div>
      </div>

      {/* AC7: disabled while cart has unavailable items or is empty */}
      <div className="flex justify-end">
        <Link
          href={canCheckout ? "/checkout" : "#"}
          aria-disabled={canCheckout ? undefined : "true"}
          aria-label={t("cart.checkout.proceed_aria")}
          className={
            canCheckout
              ? "inline-flex items-center justify-center px-6 py-2.5 rounded-md bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
              : "inline-flex items-center justify-center px-6 py-2.5 rounded-md bg-muted text-muted-foreground text-sm font-medium cursor-not-allowed pointer-events-none"
          }
          tabIndex={canCheckout ? undefined : -1}
        >
          {t("cart.checkout.proceed")}
        </Link>
      </div>
    </div>
  );
}
