import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireActiveAccount } from "@/lib/auth/server";
import { calculateCart } from "@/lib/cart/calculate";
import CartPageClient from "@/components/cart/CartPageClient";

export const metadata: Metadata = {
  title: "Cart",
  robots: { index: false },
};

export default async function CartPage() {
  const auth = await requireActiveAccount();
  if (!auth.ok) {
    redirect("/sign-in?next=/cart");
    return;
  }

  const cart = await calculateCart(auth.user.id);

  return (
    <CartPageClient initialCart={cart} />
  );
}
