"use server";

import { createCheckout, createBankOrder } from "@/lib/orders/create";
import type { CheckoutInput } from "@/types/order";

export async function createCheckoutAction(input: CheckoutInput) {
  return createCheckout(input);
}

export async function createBankOrderAction(input: CheckoutInput) {
  return createBankOrder(input);
}
