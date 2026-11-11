import "server-only";

import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireActiveAccount, getCurrentUser } from "@/lib/auth/server";
import { documentLanguageSchema, documentIdSchema } from "@/lib/validation/cart";
import type { CartItem } from "@/types/cart";
import type { DocumentLanguage } from "@/types/document";

const MAX_CART_LINES = 50;

// ─── addToCart ───────────────────────────────────────────────────────────────

export type AddToCartResult =
  | { ok: true }
  | { ok: false; code: "not_signed_in" }
  | { ok: false; code: "not_allowed" }
  | { ok: false; code: "document_unavailable" }
  | { ok: false; code: "already_in_cart" }
  | { ok: false; code: "cart_full" }
  | { ok: false; code: "validation_failed" };

export async function addToCart(
  documentId: string,
  language: DocumentLanguage,
): Promise<AddToCartResult> {
  // Auth check first so suspended users always get not_allowed, not validation_failed
  const authResult = await requireActiveAccount();
  if (!authResult.ok) {
    if (authResult.code === "account_suspended") return { ok: false, code: "not_allowed" };
    return { ok: false, code: "not_signed_in" };
  }
  const user = authResult.user;

  if (!documentIdSchema.safeParse(documentId).success) {
    return { ok: false, code: "validation_failed" };
  }
  if (!documentLanguageSchema.safeParse(language).success) {
    return { ok: false, code: "validation_failed" };
  }

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

  // Check cart line count — also enforced by DB trigger (20261111000001)
  const { count: currentCount, error: countError } = await supabase
    .from("cart_items")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);
  if (countError) throw countError;
  if ((currentCount ?? 0) >= MAX_CART_LINES) {
    return { ok: false, code: "cart_full" };
  }

  // Ensure carts row exists (upsert)
  const { error: upsertError } = await supabase
    .from("carts")
    .upsert({ user_id: user.id }, { onConflict: "user_id" });
  if (upsertError) throw upsertError;

  // Insert cart item
  const { error: insertError } = await supabase
    .from("cart_items")
    .insert({ user_id: user.id, document_id: documentId, language });

  if (insertError) {
    if (insertError.code === "23505") return { ok: false, code: "already_in_cart" };
    // DB trigger raises P0001 when cart already has 50 lines (race condition safety net)
    if (insertError.code === "P0001") return { ok: false, code: "cart_full" };
    throw insertError;
  }

  return { ok: true };
}

// ─── removeFromCart ──────────────────────────────────────────────────────────

export type RemoveFromCartResult =
  | { ok: true }
  | { ok: false; code: "not_signed_in" }
  | { ok: false; code: "not_allowed" }
  | { ok: false; code: "not_found" };

export async function removeFromCart(cartItemId: string): Promise<RemoveFromCartResult> {
  const authResult = await requireActiveAccount();
  if (!authResult.ok) {
    if (authResult.code === "account_suspended") return { ok: false, code: "not_allowed" };
    return { ok: false, code: "not_signed_in" };
  }
  const user = authResult.user;

  const supabase = await createSupabaseServerClient();

  // Check ownership before deleting (EC6: cross-user → not_found, no info leak)
  const { data: existing } = await supabase
    .from("cart_items")
    .select("id")
    .eq("id", cartItemId)
    .eq("user_id", user.id)
    .single();

  if (!existing) return { ok: false, code: "not_found" };

  const { error: deleteError } = await supabase
    .from("cart_items")
    .delete()
    .eq("id", cartItemId)
    .eq("user_id", user.id);
  if (deleteError) throw deleteError;

  return { ok: true };
}

// ─── getCart ─────────────────────────────────────────────────────────────────

export type GetCartResult = { ok: true; items: CartItem[] };

export async function getCart(): Promise<GetCartResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: true, items: [] };

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("cart_items")
    .select("id, document_id, language, created_at")
    .eq("user_id", user.id);

  if (error) throw error;

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

  const { data: orderItems, error: orderItemsError } = await supabase
    .from("order_items")
    .select("document_id, language")
    .eq("order_id", orderId);

  if (orderItemsError) throw orderItemsError;
  if (!orderItems || orderItems.length === 0) return;

  const validItems = orderItems.filter(
    (item): item is { document_id: string; language: string } =>
      documentIdSchema.safeParse(item.document_id).success && !!item.language,
  );
  if (validItems.length === 0) return;

  // Single DELETE with OR filter — avoids N round trips for large orders
  const orFilter = validItems
    .map((item) => `and(document_id.eq.${item.document_id},language.eq.${item.language})`)
    .join(",");

  const { error: clearError } = await supabase
    .from("cart_items")
    .delete()
    .eq("user_id", userId)
    .or(orFilter);
  if (clearError) throw clearError;
}
