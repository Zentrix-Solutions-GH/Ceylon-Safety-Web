// AC3: auth layout — centred card, logo wordmark; no Header, Footer, ads, analytics.
// AC9: noindex — auth pages must not appear in search results.
import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { t } from "@/messages/en";

export const metadata: Metadata = {
  robots: { index: false },
};

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo / wordmark — EC6: text until Q47 supplies actual logo */}
        <header className="flex justify-center">
          <Link
            href="/"
            aria-label={t("nav.home_link_label")}
            className="text-2xl font-bold text-primary"
          >
            {t("site.wordmark")}
          </Link>
        </header>

        {/* Page content (sign-in, sign-up, verify, reset, suspended) */}
        <main id="main-content" tabIndex={-1} className="rounded-lg border bg-card p-6 shadow-sm">
          {children}
        </main>
      </div>
    </div>
  );
}
