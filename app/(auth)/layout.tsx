// AC3: auth layout — no Header, Footer, ads, analytics.
// AC9: noindex — auth pages must not appear in search results.
import type { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false },
};

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
