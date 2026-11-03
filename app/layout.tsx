// Root layout: html, body, fonts (S-022), globals.css
import type { ReactNode } from "react";
import { Inter, Noto_Sans_Sinhala, Noto_Sans_Tamil } from "next/font/google";
import "./globals.css";

// Latin — preloaded; variable font covers all weights
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
  preload: true,
});

// Sinhala — not preloaded; unicode-range restricts download to pages with Sinhala glyphs (EC3)
const notoSinhala = Noto_Sans_Sinhala({
  subsets: ["sinhala"],
  weight: ["400"],
  display: "swap",
  variable: "--font-sinhala",
  preload: false,
});

// Tamil — not preloaded; unicode-range restricts download to pages with Tamil glyphs (EC3)
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
      <body>{children}</body>
    </html>
  );
}
