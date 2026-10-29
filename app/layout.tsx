// Root layout: html, body, fonts, providers, cookie consent banner
// Frontend owner: S-022 (fonts/providers); S-023 adds globals.css
import type { ReactNode } from "react";
import "./globals.css";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}