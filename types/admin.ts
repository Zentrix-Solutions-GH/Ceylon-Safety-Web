// Backend-owned. Admin panel design §5.1, §16.
// S-101: AdminTodayResult and QueueLine types.

export interface QueueLine {
  /** Number of items waiting. */
  count: number;
  /** ISO timestamp of the oldest waiting item, or null when count is 0. */
  oldestAt: string | null;
}

export interface BankSlipLine extends QueueLine {
  /** Count of slips waiting for a second approval (subset of count). */
  needsSecondApproval: number;
}

export interface TodayOrdersLine {
  /** Count of paid orders today (Asia/Colombo day). */
  count: number;
  /** Gross total in cents (LKR). */
  grossCents: number;
}

/**
 * Result of getAdminToday(). Each queue line is present only when the caller
 * has the matching permission; absent lines are simply not included.
 * Money values are in cents — the frontend formats them.
 */
export interface AdminTodayResult {
  /** Pending article + video comments (requires comments.moderate). */
  comments?: QueueLine;
  /** Bank transfer orders in pending_verification (requires bank_transfers.review). */
  bankSlips?: BankSlipLine;
  /** Open download requests (requires download_requests.review). */
  downloadRequests?: QueueLine;
  /** Orders flagged needs_review (requires orders.read). */
  ordersNeedingReview?: QueueLine;
  /** Today's paid orders (requires orders.read). */
  todayOrders?: TodayOrdersLine;
}
