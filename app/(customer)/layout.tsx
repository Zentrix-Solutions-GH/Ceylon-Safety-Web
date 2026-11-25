// AC4: customer layout — simple header with account menu; no public nav, ads or analytics.
// AC9: noindex — customer pages must not appear in search results.
// AC8 (S-091): fetches cart count server-side so CustomerHeader can show the badge.
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { CustomerHeader } from "@/components/layout/CustomerHeader";
import { getCartCount } from "@/lib/cart/count";
import { getCurrentUserCached } from "./user-cache";

export const metadata: Metadata = {
  robots: { index: false },
};

export default async function CustomerLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUserCached();
  const cartCount = user ? await getCartCount(user.id) : 0;
  return (
    <>
      <CustomerHeader cartCount={cartCount} />
      <main id="main-content" tabIndex={-1}>{children}</main>
    </>
  );
}
