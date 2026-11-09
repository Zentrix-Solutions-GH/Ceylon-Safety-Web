import { describe, it, expect } from "vitest";
import {
  AUTH_ERROR_CODES,
  COMMON_ERROR_CODES,
} from "@/types/auth";

// AC10: verify the exact error code sets match what the story and auth design require.
// TypeScript catches omissions at compile time, but this snapshot catches a silent removal.

describe("AUTH_ERROR_CODES (AC10)", () => {
  const EXPECTED_AUTH_CODES = [
    "invalid_credentials",
    "email_not_verified",
    "code_invalid",
    "code_expired",
    "code_attempts_exceeded",
    "weak_password",
    "captcha_failed",
    "account_suspended",
    "already_enrolled",
  ] as const;

  it("contains exactly the auth-only codes listed in the story", () => {
    expect([...AUTH_ERROR_CODES].sort()).toEqual([...EXPECTED_AUTH_CODES].sort());
  });
});

describe("COMMON_ERROR_CODES (AC10)", () => {
  const EXPECTED_COMMON_CODES = [
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

  it("contains exactly the common codes listed in the story", () => {
    expect([...COMMON_ERROR_CODES].sort()).toEqual([...EXPECTED_COMMON_CODES].sort());
  });
});
