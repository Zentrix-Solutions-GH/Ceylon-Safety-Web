// Root layout: html, body, fonts (S-022), skip link, toast area, cookie banner mount.
import type { ReactNode } from "react";
import { Inter, Noto_Sans_Sinhala, Noto_Sans_Tamil } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
import CookieConsentBanner from "@/components/layout/CookieConsentBanner";
import { t } from "@/messages/en";
import "./globals.css";

// Latin -- preloaded; variable font covers all weights
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
  preload: true,
});

// Sinhala -- not preloaded; unicode-range restricts download to pages with Sinhala glyphs (EC3)
const notoSinhala = Noto_Sans_Sinhala({
  subsets: ["sinhala"],
  weight: ["400"],
  display: "swap",
  variable: "--font-sinhala",
  preload: false,
});

// Tamil -- not preloaded; unicode-range restricts download to pages with Tamil glyphs (EC3)
const notoTamil = Noto_Sans_Tamil({
  subsets: ["tamil"],
  weight: ["400"],
  display: "swap",
  variable: "--font-tamil",
  preload: false,
});

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${notoSinhala.variable} ${notoTamil.variable}`}
    >
      <body>
        {/* AC1: skip link must be first in the page */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded focus:bg-background focus:px-4 focus:py-2 focus:text-foreground focus:shadow-md"
        >
          {t("layout.skip_to_main")}
        </a>

        {/* AC4 (S-029): banner in DOM before page content so keyboard reaches it right after skip link */}
        <CookieConsentBanner />

        {children}

        {/* AC1: toast area */}
        <Toaster />
      </body>
    </html>
  );
}