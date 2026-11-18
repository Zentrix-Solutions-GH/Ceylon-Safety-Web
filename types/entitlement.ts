// S-085: Download entitlement types.

export interface Entitlement {
  id: string;
  userId: string;
  documentId: string | null;
  orderItemId: string | null;
  language: string | null;
  downloadLimit: number;
  downloadsUsed: number;
  revokedAt: string | null;
  grantedAt: string;
  source: string;
}

/** Data needed by the download page /download/[orderItemId] (AC8). */
export interface DownloadPageData {
  entitlementId: string;
  titleSnapshot: string;
  language: string | null;
  downloadsLeft: number;
}
