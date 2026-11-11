import type { DocumentLanguage } from "@/types/document";

export type OrderStatus =
  | "pending"
  | "pending_verification"
  | "paid"
  | "failed"
  | "cancelled"
  | "refunded";

export interface BillingDetails {
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  city: string;
  company?: string;
  taxId?: string;
  saveToProfile?: boolean;
}

export interface CheckoutLine {
  documentId: string;
  language: DocumentLanguage;
}

export interface CheckoutInput {
  billing: BillingDetails;
  /** Client-supplied total for verification. Cents (integer). */
  expectedTotalCents: number;
  /** Buyer must have checked the terms-and-refund checkbox (AC8). */
  acceptedTerms: boolean;
  /** If provided, bypass the cart and use this single line. */
  buyNow?: CheckoutLine;
}

export interface CheckoutResult {
  orderId: string;
  orderNumber: string;
  totalCents: number;
}

export interface BankOrderResult {
  orderId: string;
  orderNumber: string;
}
