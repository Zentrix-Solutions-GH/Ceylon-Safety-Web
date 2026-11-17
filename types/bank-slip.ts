// S-083/S-084: Bank slip types consumed by S-084 (admin queue), S-094 (bank transfer screen), S-096 (My Purchases).

export type BankSlipStatus = "uploaded" | "awaiting_second_approval" | "accepted" | "rejected";

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

// S-084: Admin queue types (consumed by S-097 admin queue screen).
export interface BankQueueItem {
  orderId: string;
  orderNumber: string;
  createdAt: string;
  amountCents: number;
  buyerName: string;
  latestSlipId: string;
  latestSlipUploadedAt: string;
  awaitingSecondApproval: boolean;
}

export interface BankQueueResult {
  pending: BankQueueItem[];
  secondApproval: BankQueueItem[];
}
