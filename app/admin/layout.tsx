// AC5: admin layout — plain shell, noindex, no public header/ads/analytics.
// Sidebar and top bar come in S-045.
import type { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <main id="main-content" tabIndex={-1}>{children}</main>
    </div>
  );
}
