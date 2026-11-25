"use server";

import { z } from "zod";
import { requireActiveAccount } from "@/lib/auth/server";
import { removeFromCart } from "@/lib/cart/index";

const cartItemIdSchema = z.string().uuid();

export async function removeFromCartAction(
  cartItemId: string,
): Promise<{ ok: false; code: "not_signed_in" | "not_allowed" | "not_found" | "validation_failed" } | { ok: true }> {
  // Security: verify caller identity before delegating
  const auth = await requireActiveAccount();
  if (!auth.ok) {
    if (auth.code === "account_suspended") return { ok: false, code: "not_allowed" };
    return { ok: false, code: "not_signed_in" };
  }

  // Validate input before passing to lib
  const parsed = cartItemIdSchema.safeParse(cartItemId);
  if (!parsed.success) return { ok: false, code: "validation_failed" };

  return removeFromCart(parsed.data);
}
