// AC4: customer layout — simple header with account menu; no public nav, ads or analytics.
// AC9: noindex — customer pages must not appear in search results.
// AC8 (S-091): fetches cart count server-side so CustomerHeader can show the badge.
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { CustomerHeader } from "@/components/layout/CustomerHeader";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  robots: { index: false },
};

async function getCartCount(): Promise<number> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return 0;
    const { count } = await supabase
      .from("cart_items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userData.user.id);
    return count ?? 0;
  } catch {
    return 0;
  }
}

export default async function CustomerLayout({ children }: { children: ReactNode }) {
  const cartCount = await getCartCount();
  return (
    <>
      <CustomerHeader cartCount={cartCount} />
      <main id="main-content" tabIndex={-1}>{children}</main>
    </>
  );
}
