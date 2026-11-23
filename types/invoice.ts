// Invoice status returned by GET /api/invoice/[orderId] when the PDF is not yet ready.
export type InvoiceStatus = "ready" | "being_prepared";

// Shape of the seller_snapshot JSONB column (Q45: name + address only).
export interface SellerSnapshot {
  name: string;
  address: string;
}
