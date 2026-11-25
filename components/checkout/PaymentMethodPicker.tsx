"use client";

import { t } from "@/messages/en";

export type PaymentMethod = "card" | "bank";

interface Props {
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
}

export default function PaymentMethodPicker({ value, onChange }: Props) {
  return (
    <fieldset>
      <legend>{t("checkout.payment_method.heading")}</legend>
      <label>
        <input
          type="radio"
          name="payment-method"
          value="card"
          checked={value === "card"}
          onChange={() => onChange("card")}
          aria-label={t("checkout.payment_method.card")}
        />
        {t("checkout.payment_method.card")}
      </label>
      <label>
        <input
          type="radio"
          name="payment-method"
          value="bank"
          checked={value === "bank"}
          onChange={() => onChange("bank")}
          aria-label={t("checkout.payment_method.bank")}
        />
        {t("checkout.payment_method.bank")}
      </label>
    </fieldset>
  );
}
