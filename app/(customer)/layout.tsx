// AC4: customer layout — simple header with account menu; no public nav, ads or analytics.
// AC9: noindex — customer pages must not appear in search results.
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { CustomerHeader } from "@/components/layout/CustomerHeader";

export const metadata: Metadata = {
  robots: { index: false },
};

export default function CustomerLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <CustomerHeader />
      <main id="main-content" tabIndex={-1}>{children}</main>
    </>
  );
}
