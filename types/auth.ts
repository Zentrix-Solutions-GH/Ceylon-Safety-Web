// Backend-owned. Auth design §9, §17 (M19).

export const AUTH_ERROR_CODES = [
  "invalid_credentials",
  "email_not_verified",
  "code_invalid",
  "code_expired",
  "code_attempts_exceeded",
  "weak_password",
  "captcha_failed",
  "account_suspended",
] as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];

// ─── Common error codes (shared across all server actions) ───────────────────

export const COMMON_ERROR_CODES = [
  "validation_failed",
  "not_allowed",
  "not_found",
  "rate_limited",
  "version_conflict",
  "upload_failed",
  "purge_failed",
  "reauth_required",
  "mfa_required",
  "unknown",
] as const;

export type CommonErrorCode = (typeof COMMON_ERROR_CODES)[number];

export type ErrorCode = CommonErrorCode | AuthErrorCode;

// ─── Action result shape ─────────────────────────────────────────────────────

export type ActionResult<T = undefined> =
  | (T extends undefined ? { ok: true } : { ok: true } & T)
  | { ok: false; code: ErrorCode; field?: string };

// ─── JWT claim shapes (added by the custom_access_token hook, S-012) ─────────

export type UserRole = "super_admin" | "admin" | "maintainer";
export type AccountStatus = "active" | "suspended";

export interface UserRoleClaim {
  user_role?: UserRole;
}

export interface AccountStatusClaim {
  account_status?: AccountStatus;
}

// ─── Session user (what auth helpers return) ──────────────────────────────────

export interface SessionUser {
  id: string;
  email: string;
  /** Claim from the JWT (may be up to ~1 hour stale). Always re-check DB in server code. */
  claimedRole?: UserRole;
  /** Claim from the JWT (may be up to ~1 hour stale). requireActiveAccount() re-checks DB. */
  claimedStatus?: AccountStatus;
  /** ISO timestamp of the last full sign-in, derived from AMR or last_sign_in_at (EC4). */
  lastFullSignIn?: string;
  /** True when the session passed TOTP verification (amr contains 'totp'). */
  hasAuthenticatorLevel: boolean;
  /** True when the user has at least one verified TOTP factor enrolled. */
  hasTotpEnrolled: boolean;
}
