import { t } from "@/messages/en";
import type { CartCalculateResponse } from "@/types/cart";
import { formatPrice } from "@/components/cart/format-price";

interface Props {
  cart: CartCalculateResponse;
}

export default function OrderSummary({ cart }: Props) {
  return (
    <section aria-label={t("checkout.order_summary.heading")}>
      <h2>{t("checkout.order_summary.heading")}</h2>
      <ul>
        {cart.items.map((item) => (
          <li key={`${item.documentId}-${item.language}`}>
            <span>{item.title}</span>
            <span>({t("checkout.order_summary.language")}: {item.language.toUpperCase()})</span>
            <span>{formatPrice(item.price)}</span>
          </li>
        ))}
      </ul>
      <div>
        <span>{t("checkout.order_summary.subtotal")}</span>
        <span>{formatPrice(cart.subtotal)}</span>
      </div>
      <div>
        <strong>{t("checkout.order_summary.total")}</strong>
        <strong>{formatPrice(cart.total)}</strong>
      </div>
    </section>
  );
}
