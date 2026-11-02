// AC1: root layout — html lang="en", body, skip link, toast area, cookie banner mount.
// No ad or analytics scripts and no session read.
// Fonts: S-022 will add @font-face and CSS custom properties to globals.css; no font
// class is added here so S-022 lands with zero changes to this file.
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import CookieConsentBanner from "@/components/layout/CookieConsentBanner";
import { t } from "@/messages/en";
import "./globals.css";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* AC1: skip link must be first in the page */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded focus:bg-background focus:px-4 focus:py-2 focus:text-foreground focus:shadow-md"
        >
          {t("layout.skip_to_main")}
        </a>

        {children}

        {/* AC1: toast area */}
        <Toaster />

        {/* AC1: cookie banner mount point — filled by S-029 */}
        <CookieConsentBanner />
      </body>
    </html>
  );
}
