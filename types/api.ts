// Backend-owned. Defined here as a scaffold until backend fills in error codes.
// Shape: auth design §17 (M19).

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; code: string; reason?: string; field?: string };

// Runtime list used by messages/__tests__/errors.test.ts to verify coverage.
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
