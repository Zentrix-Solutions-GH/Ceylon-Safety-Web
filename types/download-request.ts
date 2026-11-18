// S-085: Download request types.

export type DownloadRequestStatus = "open" | "approved" | "rejected";

export interface DownloadRequest {
  id: string;
  entitlementId: string;
  userId: string;
  status: DownloadRequestStatus;
  note: string | null;
  requestedAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
  decisionNote: string | null;
}

/** Row shown in the admin queue (AC13). */
export interface DownloadQueueItem {
  requestId: string;
  entitlementId: string;
  buyerName: string;
  buyerEmail: string;
  documentTitle: string;
  language: string | null;
  lastDownloadAt: string | null;
  note: string | null;
  requestedAt: string;
}

export interface DownloadQueueResult {
  items: DownloadQueueItem[];
  totalOpen: number;
}
