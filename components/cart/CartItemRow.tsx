"use client";

import Image from "next/image";
import { t } from "@/messages/en";
import type { CartLineResult } from "@/types/cart";
import { formatPrice } from "@/components/cart/format-price";

const LANG_BADGE: Record<string, string> = { en: "EN", si: "SI", ta: "TA" };

interface CartItemRowProps {
  item: CartLineResult;
  onRemove: (cartItemId: string) => void;
  isRemoving: boolean;
}

export default function CartItemRow({ item, onRemove, isRemoving }: CartItemRowProps) {
  return (
    <div className="flex items-start gap-4 py-4 border-b last:border-b-0">
      {item.coverUrl && (
        <Image
          src={item.coverUrl}
          alt={item.title}
          width={64}
          height={64}
          className="object-cover rounded shrink-0"
        />
      )}

      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{item.title}</p>

        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs font-semibold uppercase tracking-wide bg-muted px-1.5 py-0.5 rounded">
            {LANG_BADGE[item.language] ?? item.language.toUpperCase()}
          </span>

          {!item.available && (
            <span className="text-xs font-semibold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">
              {t("cart.item.unavailable")}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col items-end gap-2 shrink-0">
        <span className="text-sm font-medium">LKR {formatPrice(item.price)}</span>

        <button
          type="button"
          onClick={() => item.cartItemId && onRemove(item.cartItemId)}
          disabled={isRemoving || !item.cartItemId}
          aria-label={t("cart.item.remove")}
          className="text-xs text-muted-foreground hover:text-destructive disabled:opacity-50 transition-colors"
        >
          {isRemoving ? t("cart.item.removing") : t("cart.item.remove")}
        </button>
      </div>
    </div>
  );
}
