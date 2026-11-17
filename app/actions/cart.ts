"use server";

import { addToCart as _addToCart } from "@/lib/cart/index";
import type { AddToCartResult } from "@/lib/cart/index";
import type { DocumentLanguage } from "@/types/document";

export async function addToCart(
  documentId: string,
  language: DocumentLanguage,
): Promise<AddToCartResult> {
  return _addToCart(documentId, language);
}
