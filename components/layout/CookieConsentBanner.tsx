"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { getConsent, setConsent } from "@/lib/consent";
import { t } from "@/messages/en";
import { cn } from "@/lib/utils/cn";

type ConsentValue = "undecided" | "accepted" | "rejected";

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [currentChoice, setCurrentChoice] = useState<ConsentValue>("undecided");
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (getConsent() === "undecided") {
      setVisible(true);
    }

    function handleOpen(e: Event) {
      const detail = (e as CustomEvent<{ trigger: HTMLElement | null }>).detail;
      triggerRef.current = detail?.trigger ?? null;
      setCurrentChoice(getConsent());
      setVisible(true);
    }

    window.addEventListener("open-cookie-banner", handleOpen);
    return () => window.removeEventListener("open-cookie-banner", handleOpen);
  }, []);

  useEffect(() => {
    if (!visible) return;
    document.body.style.paddingBottom = "4rem";
    document.documentElement.style.scrollPaddingBottom = "4rem";
    return () => {
      document.body.style.paddingBottom = "";
      document.documentElement.style.scrollPaddingBottom = "";
    };
  }, [visible]);

  function handleChoice(choice: "accepted" | "rejected") {
    try { setConsent(choice); } catch { /* EC1: ignore storage errors */ }
    setVisible(false);
    const target = triggerRef.current;
    triggerRef.current = null;
    if (target) {
      target.focus();
    } else {
      (document.getElementById("main-content") as HTMLElement | null)?.focus();
    }
  }

  if (!visible) return null;

  const btnClass =
    "inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const selectedClass = cn(btnClass, "ring-2 ring-primary");

  return (
    <div
      role="region"
      aria-label={t("cookie.banner_label")}
      className="fixed bottom-0 left-0 right-0 z-[100] border-t bg-background px-4 py-3 shadow-md"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-foreground">
          {t("cookie.banner_text")}{" "}
          <Link href="/privacy" className="underline hover:no-underline">
            {t("cookie.privacy_link")}
          </Link>
          {t("cookie.privacy_link_suffix")}
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            className={currentChoice === "accepted" ? selectedClass : btnClass}
            aria-pressed={currentChoice === "accepted"}
            onClick={() => handleChoice("accepted")}
          >
            {t("cookie.accept")}
          </button>
          <button
            className={currentChoice === "rejected" ? selectedClass : btnClass}
            aria-pressed={currentChoice === "rejected"}
            onClick={() => handleChoice("rejected")}
          >
            {t("cookie.reject")}
          </button>
        </div>
      </div>
    </div>
  );
}
