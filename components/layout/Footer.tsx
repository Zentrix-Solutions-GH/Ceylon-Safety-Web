"use client";

import { useRef } from "react";
import { t } from "@/messages/en";

export interface FooterSettings {
  contact_email?: string | null;
  contact_phone?: string | null;
  footer_address?: string | null;
  social_facebook?: string | null;
  social_instagram?: string | null;
  social_linkedin?: string | null;
  social_youtube?: string | null;
}

export interface FooterCategory {
  name: string;
  slug: string;
}

export default function Footer({}: {
  settings?: FooterSettings | null;
  categories?: FooterCategory[];
} = {}) {
  const btnRef = useRef<HTMLButtonElement>(null);

  function handleCookieSettings() {
    window.dispatchEvent(
      new CustomEvent("open-cookie-banner", { detail: { trigger: btnRef.current } })
    );
  }

  return (
    <footer>
      <button
        ref={btnRef}
        type="button"
        onClick={handleCookieSettings}
        className="text-sm underline hover:no-underline"
      >
        {t("cookie.settings_link")}
      </button>
    </footer>
  );
}