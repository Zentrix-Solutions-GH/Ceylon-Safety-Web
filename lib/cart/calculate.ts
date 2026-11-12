import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { publicUrl } from "@/lib/media/publicUrl";
import type { CartLineResult, CartCalculateResponse } from "@/types/cart";
import type { DocumentLanguage } from "@/types/document";

interface BuyNow {
  documentId: string;
  language: DocumentLanguage;
}

export async function calculateCart(
  userId: string,
  buyNow?: BuyNow,
): Promise<CartCalculateResponse> {
  const supabase = await createSupabaseServerClient();

  let lines: Array<{ cartItemId: string | null; documentId: string; language: DocumentLanguage }>;

  if (buyNow) {
    lines = [{ cartItemId: null, documentId: buyNow.documentId, language: buyNow.language }];
  } else {
    const { data: cartItems, error: cartError } = await supabase
      .from("cart_items")
      .select("id, document_id, language")
      .eq("user_id", userId);

    if (cartError) throw cartError;

    lines = (cartItems ?? []).map((row) => ({
      cartItemId: row.id,
      documentId: row.document_id,
      language: row.language as DocumentLanguage,
    }));
  }

  if (lines.length === 0) return { items: [], subtotal: 0, total: 0 };

  const documentIds = [...new Set(lines.map((l) => l.documentId))];

  // Fetch documents and their file availability in one query
  const { data: docs, error: docsError } = await supabase
    .from("documents")
    .select(
      "id, title, slug, cover_image_key, price_cents, page_count, status, deleted_at",
    )
    .in("id", documentIds)
    .is("deleted_at", null)
    .eq("status", "published");

  if (docsError) throw docsError;

  const docMap = new Map((docs ?? []).map((d) => [d.id, d]));

  // Fetch ready full-language files for the documents (kind='full', is_current=true, status='ready')
  const { data: files, error: filesError } = await supabase
    .from("document_files")
    .select("document_id, language, kind, status, is_current")
    .in("document_id", documentIds)
    .eq("kind", "full")
    .eq("is_current", true)
    .eq("status", "ready");

  if (filesError) throw filesError;

  const readyFiles = new Set(
    (files ?? []).map((f) => `${f.document_id}:${f.language}`),
  );

  const items: CartLineResult[] = lines.map((line) => {
    const doc = docMap.get(line.documentId);

    if (!doc || doc.status !== "published" || doc.deleted_at != null) {
      return {
        cartItemId: line.cartItemId,
        documentId: line.documentId,
        title: doc?.title ?? "",
        slug: doc?.slug ?? "",
        coverUrl: null,
        language: line.language,
        pageCount: null,
        price: 0,
        available: false,
        unavailableReason: "document_unavailable",
      };
    }

    const fileKey = `${line.documentId}:${line.language}`;
    if (!readyFiles.has(fileKey)) {
      return {
        cartItemId: line.cartItemId,
        documentId: line.documentId,
        title: doc.title,
        slug: doc.slug,
        coverUrl: doc.cover_image_key ? publicUrl(doc.cover_image_key) : null,
        language: line.language,
        pageCount: doc.page_count ?? null,
        price: 0,
        available: false,
        unavailableReason: "language_unavailable",
      };
    }

    return {
      cartItemId: line.cartItemId,
      documentId: line.documentId,
      title: doc.title,
      slug: doc.slug,
      coverUrl: doc.cover_image_key ? publicUrl(doc.cover_image_key) : null,
      language: line.language,
      pageCount: doc.page_count ?? null,
      price: doc.price_cents,
      available: true,
    };
  });

  const subtotal = items.reduce((sum, item) => sum + (item.available ? item.price : 0), 0);

  return { items, subtotal, total: subtotal };
}
