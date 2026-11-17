// S-083: Bank slip types consumed by S-084 (admin queue), S-094 (bank transfer screen), S-096 (My Purchases).

export type BankSlipStatus = "uploaded" | "accepted" | "rejected";

export interface SlipSummary {
  status: BankSlipStatus;
  uploadedAt: string;
  rejectionReason: string | null;
}

export interface BankOrderView {
  orderId: string;
  orderNumber: string;
  status: string;
  bankDetails: string;
  slips: SlipSummary[];
}
