// Backend-owned scaffold. Auth design §17 (M19).

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
