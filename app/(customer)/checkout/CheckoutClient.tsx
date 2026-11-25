"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { t } from "@/messages/en";
import OrderSummary from "@/components/checkout/OrderSummary";
import BillingForm from "@/components/checkout/BillingForm";
import TermsCheckbox from "@/components/checkout/TermsCheckbox";
import PaymentMethodPicker, { type PaymentMethod } from "@/components/checkout/PaymentMethodPicker";
import PayHereRedirect from "@/components/checkout/PayHereRedirect";
import { createCheckoutAction, createBankOrderAction } from "./actions";
import type { CartCalculateResponse } from "@/types/cart";
import type { BillingDetails } from "@/types/order";
import type { PayHereFormFields } from "@/types/payhere";

interface Prefill {
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  billingAddress?: { line1: string; city: string; country: string; line2?: string; state?: string; postalCode?: string } | null;
  companyName: string | null;
  taxId: string | null;
}

interface Props {
  initialCart: CartCalculateResponse;
  email: string;
  prefill: Prefill;
}

type CheckoutError =
  | "price_changed"
  | "item_unavailable"
  | "coupon_invalid"
  | "rate_limited"
  | "payment_unavailable"
  | "pending_order_exists"
  | "payment_in_progress"
  | "generic";

export default function CheckoutClient({ initialCart, email, prefill }: Props) {
  const router = useRouter();

  const [cart, setCart] = useState(initialCart);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<CheckoutError | null>(null);
  const [payhereFields, setPayhereFields] = useState<PayHereFormFields | null>(null);

  const [billing, setBilling] = useState<BillingDetails>({
    firstName: prefill.firstName ?? "",
    lastName: prefill.lastName ?? "",
    phone: prefill.phone ?? "",
    address: prefill.billingAddress?.line1 ?? "",
    city: prefill.billingAddress?.city ?? "",
    company: prefill.companyName ?? undefined,
    taxId: prefill.taxId ?? undefined,
    saveToProfile: false,
  });

  async function refreshCart() {
    try {
      const res = await fetch("/api/cart/calculate", { method: "POST" });
      if (res.ok) {
        const updated = (await res.json()) as CartCalculateResponse;
        setCart(updated);
      }
    } catch {
      // best-effort; stale cart shown until next reload
    }
  }

  async function handleSubmit() {
    if (!termsAccepted || submitting) return;
    setError(null);
    setSubmitting(true);

    const input = {
      billing,
      expectedTotalCents: cart.total,
      acceptedTerms: true,
    };

    if (paymentMethod === "card") {
      const result = await createCheckoutAction(input);
      setSubmitting(false);

      if (!result.ok) {
        const code = result.code as string;
        if (code === "price_changed" || code === "item_unavailable") {
          await refreshCart();
          setError(code as CheckoutError);
        } else if (code === "coupon_invalid") {
          setError("coupon_invalid");
        } else if (code === "pending_order_exists") {
          setError("pending_order_exists");
        } else if (code === "payment_in_progress") {
          setError("payment_in_progress");
        } else if (code === "rate_limited") {
          setError("rate_limited");
        } else if (code === "payment_unavailable") {
          setError("payment_unavailable");
        } else if (code === "not_authenticated" || code === "not_allowed") {
          router.push("/sign-in?next=/checkout");
          return;
        } else {
          setError("generic");
        }
        return;
      }

      setPayhereFields(result.data!.payhereFields);
    } else {
      const result = await createBankOrderAction(input);
      setSubmitting(false);

      if (!result.ok) {
        const code = result.code as string;
        if (code === "price_changed" || code === "item_unavailable") {
          await refreshCart();
          setError(code as CheckoutError);
        } else if (code === "rate_limited") {
          setError("rate_limited");
        } else if (code === "not_authenticated" || code === "not_allowed") {
          router.push("/sign-in?next=/checkout");
          return;
        } else {
          setError("generic");
        }
        return;
      }

      router.push(`/checkout/pending?order=${result.data!.orderId}`);
    }
  }

  if (payhereFields) {
    return <PayHereRedirect fields={payhereFields} />;
  }

  if (cart.items.length === 0) {
    return <p>{t("checkout.empty_cart")}</p>;
  }

  return (
    <main>
      <h1>{t("checkout.title")}</h1>

      <OrderSummary cart={cart} />

      <BillingForm value={billing} email={email} onChange={setBilling} />

      <PaymentMethodPicker value={paymentMethod} onChange={setPaymentMethod} />

      <TermsCheckbox checked={termsAccepted} onChange={() => setTermsAccepted((v) => !v)} />

      {error && error !== "pending_order_exists" && error !== "payment_in_progress" && (
        <p role="alert">
          {t(`checkout.error.${error === "generic" ? "generic" : error}` as Parameters<typeof t>[0])}
        </p>
      )}

      {error === "payment_in_progress" && (
        <p role="alert">{t("checkout.payment_in_progress")}</p>
      )}

      {error === "pending_order_exists" && (
        <div role="alert">
          <p>{t("checkout.pending_order.message")}</p>
          <button type="button" onClick={async () => { setError(null); await handleSubmit(); }}>
            {t("checkout.pending_order.continue")}
          </button>
          <button
            type="button"
            onClick={async () => {
              setError(null);
              await handleSubmit();
            }}
          >
            {t("checkout.pending_order.replace")}
          </button>
        </div>
      )}

      {paymentMethod === "card" ? (
        <button
          type="button"
          aria-label={t("checkout.pay_button", { amount: (cart.total / 100).toFixed(2) })}
          disabled={!termsAccepted || submitting}
          aria-disabled={!termsAccepted || submitting}
          onClick={handleSubmit}
        >
          {submitting
            ? t("checkout.processing")
            : t("checkout.pay_button", { amount: (cart.total / 100).toFixed(2) })}
        </button>
      ) : (
        <button
          type="button"
          aria-label={t("checkout.bank_button")}
          disabled={!termsAccepted || submitting}
          aria-disabled={!termsAccepted || submitting}
          onClick={handleSubmit}
        >
          {submitting ? t("checkout.processing") : t("checkout.bank_button")}
        </button>
      )}
    </main>
  );
}
