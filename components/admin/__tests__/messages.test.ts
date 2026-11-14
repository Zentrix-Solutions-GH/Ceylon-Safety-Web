// S-073 AC10: message mapping has no raw error codes
import { describe, it, expect } from "vitest";
import { errorMessage } from "@/messages/en";

describe("errorMessage — admin document codes (AC10)", () => {
  it("files_missing maps to design-doc canonical text", () => {
    expect(errorMessage("validation_failed", "files_missing")).toBe(
      "Upload all three language files and the preview first."
    );
  });

  it("mfa_required maps to design-doc canonical text", () => {
    expect(errorMessage("mfa_required")).toBe(
      "Enter the code from your authenticator app."
    );
  });

  it("version_conflict maps to plain text, no raw code", () => {
    const msg = errorMessage("version_conflict");
    expect(msg).not.toContain("version_conflict");
    expect(msg.length).toBeGreaterThan(10);
  });

  it("confirm_large_change maps to plain text", () => {
    const msg = errorMessage("validation_failed", "confirm_large_change");
    expect(msg).not.toContain("confirm_large_change");
  });

  it("upload_failed maps to plain text", () => {
    const msg = errorMessage("upload_failed");
    expect(msg).not.toContain("upload_failed");
  });

  it("file_type maps to plain text", () => {
    const msg = errorMessage("validation_failed", "file_type");
    expect(msg).not.toContain("file_type");
  });

  it("file_too_large maps to plain text", () => {
    const msg = errorMessage("validation_failed", "file_too_large");
    expect(msg).not.toContain("file_too_large");
  });

  it("already_done maps to plain text", () => {
    const msg = errorMessage("validation_failed", "already_done");
    expect(msg).not.toContain("already_done");
  });

  it("not_allowed maps to plain text", () => {
    const msg = errorMessage("not_allowed");
    expect(msg).not.toContain("not_allowed");
  });
});
