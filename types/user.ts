// Backend-owned. S-037: updateProfile and deleteAccount action types.

import type { ActionResult } from "@/types/auth";

// ─── Saved address (Q35 assumed: billing address for invoices) ────────────────

export interface BillingAddress {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
}

// ─── updateProfile ────────────────────────────────────────────────────────────

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  phone?: string;
  companyName?: string;
  taxId?: string;
  billingAddress?: BillingAddress | null;
}

export type UpdateProfileResult = ActionResult;

// ─── deleteAccount ────────────────────────────────────────────────────────────

export interface DeleteAccountInput {
  /** Re-verification OTP code (from requestReverification / magic-link flow). */
  code: string;
  /** Required when the account has a verified TOTP factor. */
  authenticatorCode?: string;
}

export type DeleteAccountResult = ActionResult;
