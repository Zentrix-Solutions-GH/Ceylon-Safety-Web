import type { DocumentLanguage } from "@/types/document";
import type { PayHereFormFields } from "@/types/payhere";

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
  payhereFields: PayHereFormFields;
}

export interface BankOrderResult {
  orderId: string;
  orderNumber: string;
}

export interface FinalizeResult {
  orderId: string;
  invoiceOk: boolean;
  emailOk: boolean;
  finalizedAt: string | null;
}

export interface MyOrderItem {
  orderItemId: string;
  documentId: string;
  titleSnapshot: string;
  language: DocumentLanguage;
  lineTotalCents: number;
  entitlementId: string | null;
}

export interface MyOrder {
  orderId: string;
  orderNumber: string;
  status: OrderStatus;
  totalCents: number;
  createdAt: string;
  items: MyOrderItem[];
}
