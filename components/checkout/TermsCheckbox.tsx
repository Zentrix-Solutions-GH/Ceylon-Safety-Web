"use client";

import Link from "next/link";
import { t } from "@/messages/en";

interface Props {
  checked: boolean;
  onChange: () => void;
}

export default function TermsCheckbox({ checked, onChange }: Props) {
  return (
    <label style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
      <input type="checkbox" checked={checked} onChange={onChange} aria-label={t("checkout.terms.label")} />
      <span>
        {t("checkout.terms.label")}{" "}
        <Link href="/terms" target="_blank" rel="noopener noreferrer">
          {t("checkout.terms.link_terms")}
        </Link>{" "}
        <Link href="/refund-policy" target="_blank" rel="noopener noreferrer">
          {t("checkout.terms.link_refund")}
        </Link>
      </span>
    </label>
  );
}
