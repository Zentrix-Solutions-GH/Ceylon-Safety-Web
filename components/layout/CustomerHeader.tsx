"use client";

// AC4: simple customer-area header — account menu only; no full nav, no ads, no analytics.
// Uses HeaderPersonal from S-025 for the sign-in state (reuses the existing client component).
import Link from "next/link";
import { HeaderPersonal } from "@/components/layout/HeaderPersonal";
import { t } from "@/messages/en";

export function CustomerHeader() {
  return (
    <header
      className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      aria-label={t("customer.header_label")}
    >
      <div className="container flex h-16 items-center justify-between px-4">
        <Link
          href="/"
          aria-label={t("nav.home_link_label")}
          className="text-lg font-bold text-primary"
        >
          {t("site.wordmark")}
        </Link>

        {/* Account menu: My Purchases, Profile, Sign out — rendered by HeaderPersonal */}
        <HeaderPersonal />
      </div>
    </header>
  );
}
