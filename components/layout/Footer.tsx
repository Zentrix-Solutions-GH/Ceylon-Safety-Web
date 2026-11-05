"use client";

import { useRef } from "react";
import { t } from "@/messages/en";

export default function Footer() {
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
