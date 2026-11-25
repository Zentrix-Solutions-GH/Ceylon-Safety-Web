"use server";

import { z } from "zod";
import { removeFromCart } from "@/lib/cart/index";

const cartItemIdSchema = z.string().uuid();

export async function removeFromCartAction(
  cartItemId: string,
): Promise<{ ok: false; code: "not_signed_in" | "not_allowed" | "not_found" | "validation_failed" } | { ok: true }> {
  const parsed = cartItemIdSchema.safeParse(cartItemId);
  if (!parsed.success) return { ok: false, code: "validation_failed" };

  return removeFromCart(parsed.data);
}
