"use client";

import { t } from "@/messages/en";
import type { BillingDetails } from "@/types/order";

interface Props {
  value: BillingDetails;
  email: string;
  onChange: (value: BillingDetails) => void;
}

export default function BillingForm({ value, email, onChange }: Props) {
  function set(field: keyof BillingDetails, v: string | boolean) {
    onChange({ ...value, [field]: v });
  }

  return (
    <fieldset>
      <legend>{t("checkout.billing.heading")}</legend>

      <label>
        {t("checkout.billing.first_name")}
        <input
          type="text"
          value={value.firstName}
          onChange={(e) => set("firstName", e.target.value)}
          required
          autoComplete="given-name"
        />
      </label>

      <label>
        {t("checkout.billing.last_name")}
        <input
          type="text"
          value={value.lastName}
          onChange={(e) => set("lastName", e.target.value)}
          required
          autoComplete="family-name"
        />
      </label>

      <label>
        {t("checkout.billing.email")}
        <input type="email" value={email} readOnly disabled autoComplete="email" />
      </label>

      <label>
        {t("checkout.billing.phone")}
        <input
          type="tel"
          value={value.phone}
          onChange={(e) => set("phone", e.target.value)}
          required
          autoComplete="tel"
        />
      </label>

      <label>
        {t("checkout.billing.address")}
        <input
          type="text"
          value={value.address}
          onChange={(e) => set("address", e.target.value)}
          required
          autoComplete="street-address"
        />
      </label>

      <label>
        {t("checkout.billing.city")}
        <input
          type="text"
          value={value.city}
          onChange={(e) => set("city", e.target.value)}
          required
          autoComplete="address-level2"
        />
      </label>

      <label>
        {t("checkout.billing.company")}
        <input
          type="text"
          value={value.company ?? ""}
          onChange={(e) => set("company", e.target.value)}
          autoComplete="organization"
        />
      </label>

      <label>
        {t("checkout.billing.tax_id")}
        <input
          type="text"
          value={value.taxId ?? ""}
          onChange={(e) => set("taxId", e.target.value)}
        />
      </label>

      <label>
        <input
          type="checkbox"
          checked={value.saveToProfile ?? false}
          onChange={(e) => set("saveToProfile", e.target.checked)}
        />
        {t("checkout.billing.save_to_profile")}
      </label>
    </fieldset>
  );
}
