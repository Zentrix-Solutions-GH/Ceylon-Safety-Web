import "server-only";

import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/server";
import type { CartItem } from "@/types/cart";
import type { DocumentLanguage } from "@/types/document";

const VALID_LANGUAGES: DocumentLanguage[] = ["en", "si", "ta"];
const MAX_CART_LINES = 50;

// ─── addToCart ───────────────────────────────────────────────────────────────

export type AddToCartResult =
  | { ok: true }
  | { ok: false; code: "not_signed_in" }
  | { ok: false; code: "document_unavailable" }
  | { ok: false; code: "already_in_cart" }
  | { ok: false; code: "cart_full" }
  | { ok: false; code: "validation_failed" };

export async function addToCart(
  documentId: string,
  language: DocumentLanguage,
): Promise<AddToCartResult> {
  if (!VALID_LANGUAGES.includes(language)) {
    return { ok: false, code: "validation_failed" };
  }

  const user = await getCurrentUser();
  if (!user) return { ok: false, code: "not_signed_in" };

  const supabase = await createSupabaseServerClient();

  // Check document exists and is published
  const { data: doc } = await supabase
    .from("documents")
    .select("id, status, deleted_at")
    .eq("id", documentId)
    .is("deleted_at", null)
    .single();

  if (!doc || doc.status !== "published") {
    return { ok: false, code: "document_unavailable" };
  }

  // Check cart line count (count: "exact", head: true — no rows fetched)
  const { count: currentCount } = await supabase
    .from("cart_items")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);
  if ((currentCount ?? 0) >= MAX_CART_LINES) {
    return { ok: false, code: "cart_full" };
  }

  // Ensure carts row exists (upsert)
  await supabase.from("carts").upsert({ user_id: user.id }, { onConflict: "user_id" });

  // Insert cart item
  const { error: insertError } = await supabase
    .from("cart_items")
    .insert({ user_id: user.id, document_id: documentId, language })
    .single();

  if (insertError) {
    if (insertError.code === "23505") return { ok: false, code: "already_in_cart" };
    throw insertError;
  }

  return { ok: true };
}

// ─── removeFromCart ──────────────────────────────────────────────────────────

export type RemoveFromCartResult =
  | { ok: true }
  | { ok: false; code: "not_signed_in" }
  | { ok: false; code: "not_found" };

export async function removeFromCart(cartItemId: string): Promise<RemoveFromCartResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, code: "not_signed_in" };

  const supabase = await createSupabaseServerClient();

  // Check ownership before deleting (EC6: cross-user → not_found, no info leak)
  const { data: existing } = await supabase
    .from("cart_items")
    .select("id")
    .eq("id", cartItemId)
    .eq("user_id", user.id)
    .single();

  if (!existing) return { ok: false, code: "not_found" };

  await supabase.from("cart_items").delete().eq("id", cartItemId).eq("user_id", user.id);
  return { ok: true };
}

// ─── getCart ─────────────────────────────────────────────────────────────────

export type GetCartResult = { ok: true; items: CartItem[] };

export async function getCart(): Promise<GetCartResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: true, items: [] };

  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("cart_items")
    .select("id, document_id, language, created_at")
    .eq("user_id", user.id);

  const items: CartItem[] = (data ?? []).map((row) => ({
    id: row.id,
    documentId: row.document_id,
    language: row.language as DocumentLanguage,
    addedAt: row.created_at,
  }));

  return { ok: true, items };
}

// ─── clearCartForOrder ───────────────────────────────────────────────────────
// Called by the payment-notification handler (S-080) inside the fulfillment
// transaction after a successful payment. Removes lines that belong to the
// paid order from the buyer's cart.

export async function clearCartForOrder(orderId: string, userId: string): Promise<void> {
  // Service-role client required: webhook caller has no user session cookie.
  // userId is passed explicitly so every delete is scoped to the buyer.
  const supabase = createSupabaseServiceRoleClient();

  const { data: orderItems } = await supabase
    .from("order_items")
    .select("document_id, language")
    .eq("order_id", orderId);

  if (!orderItems || orderItems.length === 0) return;

  for (const item of orderItems) {
    if (!item.document_id || !item.language) continue;
    await supabase
      .from("cart_items")
      .delete()
      .eq("user_id", userId)
      .eq("document_id", item.document_id as string)
      .eq("language", item.language as string);
  }
}
