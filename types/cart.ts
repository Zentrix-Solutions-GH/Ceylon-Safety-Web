import type { DocumentLanguage } from "@/types/document";

/** One item stored in the cart (no prices; prices are always live). */
export interface CartItem {
  id: string;
  documentId: string;
  language: DocumentLanguage;
  addedAt: string;
}

/** One priced line returned by /api/cart/calculate. */
export interface CartLineResult {
  cartItemId: string | null;
  documentId: string;
  title: string;
  slug: string;
  coverUrl: string | null;
  language: DocumentLanguage;
  pageCount: number | null;
  price: number;
  available: boolean;
  unavailableReason?: "document_unavailable" | "language_unavailable";
}

export interface CartCalculateResponse {
  items: CartLineResult[];
  subtotal: number;
  total: number;
}
