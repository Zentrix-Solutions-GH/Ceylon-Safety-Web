import { redirect } from "next/navigation";
import { requireActiveAccount } from "@/lib/auth/server";
import { calculateCart } from "@/lib/cart/calculate";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import CheckoutClient from "./CheckoutClient";
import type { BillingAddress } from "@/types/user";

export default async function CheckoutPage() {
  const authResult = await requireActiveAccount();
  if (!authResult.ok) {
    redirect("/sign-in?next=/checkout");
  }
  const { user } = authResult;

  const [cart, supabase] = await Promise.all([
    calculateCart(user.id),
    createSupabaseServerClient(),
  ]);

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, phone, billing_address, company_name, tax_id")
    .eq("id", user.id)
    .single();

  const billingAddress = profile?.billing_address as BillingAddress | null | undefined;

  return (
    <CheckoutClient
      initialCart={cart}
      email={user.email}
      prefill={{
        firstName: profile?.first_name ?? null,
        lastName: profile?.last_name ?? null,
        phone: profile?.phone ?? null,
        billingAddress: billingAddress ?? null,
        companyName: profile?.company_name ?? null,
        taxId: profile?.tax_id ?? null,
      }}
    />
  );
}
