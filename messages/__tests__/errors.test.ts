import { describe, it, expect } from "vitest";
import { COMMON_ERROR_CODES } from "@/types/api";
import { AUTH_ERROR_CODES } from "@/types/auth";
import { errorMessage } from "../en";

describe("errorMessage()", () => {
  it("AC2/AC3: every common error code has an entry", () => {
    const unknownFallback = errorMessage("__nonexistent__");
    for (const code of COMMON_ERROR_CODES) {
      const msg = errorMessage(code);
      expect(msg, `missing entry for common code "${code}"`).toBeTruthy();
      // "unknown" is the fallback itself, so its text equals the fallback — that's correct.
      // All other codes must have their own dedicated entry.
      if (code !== "unknown") {
        expect(msg, `code "${code}" must not fall back to unknown`).not.toBe(unknownFallback);
      }
    }
  });

  it("AC2/AC3: every auth error code has an entry", () => {
    const unknownFallback = errorMessage("__nonexistent__");
    for (const code of AUTH_ERROR_CODES) {
      const msg = errorMessage(code);
      expect(msg, `missing entry for auth code "${code}"`).toBeTruthy();
      expect(msg, `code "${code}" must not fall back to unknown`).not.toBe(unknownFallback);
    }
  });

  it("AC3: unknown code returns the unknown text", () => {
    const unknownText = errorMessage("unknown");
    expect(errorMessage("totally_made_up_code")).toBe(unknownText);
  });

  it("AC4: not_allowed uses spec-mandated text", () => {
    expect(errorMessage("not_allowed")).toBe("You do not have permission to do this.");
  });

  it("AC4: version_conflict uses spec-mandated text", () => {
    expect(errorMessage("version_conflict")).toBe(
      "Someone else changed this while you were editing. Reload to see their changes. Your text is kept."
    );
  });

  it("AC4: invalid_credentials uses spec-mandated text", () => {
    expect(errorMessage("invalid_credentials")).toBe("Email or password is not correct");
  });

  it("AC4: code_invalid uses spec-mandated text", () => {
    expect(errorMessage("code_invalid")).toBe("That code is not right");
  });

  it("AC4: code_attempts_exceeded uses spec-mandated text", () => {
    expect(errorMessage("code_attempts_exceeded")).toBe(
      "Too many wrong attempts — request a new code"
    );
  });

  it("AC4: account_suspended uses spec-mandated text", () => {
    expect(errorMessage("account_suspended")).toBe(
      "This account has been suspended. Contact support"
    );
  });

  it("AC2: rate_limited with reason=hourly returns specific text", () => {
    const hourly = errorMessage("rate_limited", "hourly");
    const def = errorMessage("rate_limited");
    expect(hourly).not.toBe(def);
    expect(hourly.length).toBeGreaterThan(0);
  });

  it("AC2: rate_limited with reason=pending_cap returns specific text", () => {
    const cap = errorMessage("rate_limited", "pending_cap");
    const def = errorMessage("rate_limited");
    expect(cap).not.toBe(def);
  });

  it("AC2: validation_failed reason variants exist", () => {
    const reasons = [
      "already_done",
      "files_missing",
      "confirm_large_change",
      "confirm_mismatch",
      "too_many_rows",
    ];
    const def = errorMessage("validation_failed");
    for (const r of reasons) {
      const msg = errorMessage("validation_failed", r);
      expect(msg, `validation_failed.${r} should differ from default`).not.toBe(def);
    }
  });

  it("EC2: unknown reason for a known code falls back to code default", () => {
    const def = errorMessage("rate_limited");
    const withUnknownReason = errorMessage("rate_limited", "this_reason_does_not_exist");
    expect(withUnknownReason).toBe(def);
  });
});
