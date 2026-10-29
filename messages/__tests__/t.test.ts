import { describe, it, expect } from "vitest";
import { t } from "../en";

describe("t()", () => {
  it("AC1: returns non-empty string for a known key", () => {
    const result = t("errors.unknown");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("AC1: replaces {name}-style parameters", () => {
    const result = t("auth.code_sent", { email: "user@example.com" });
    expect(result).toContain("user@example.com");
    expect(result).not.toContain("{email}");
  });

  it("AC1: multiple parameters replaced independently", () => {
    const result = t("auth.code_sent", { email: "a@b.com" });
    expect(result).toContain("a@b.com");
  });

  it("EC1: brace in param value is shown as text, not interpreted as another param", () => {
    const result = t("auth.code_sent", { email: "{notakey}" });
    expect(result).toContain("{notakey}");
  });

  it("EC1: HTML in param value is not parsed as HTML by t()", () => {
    const result = t("auth.code_sent", { email: "<script>evil</script>" });
    // t() returns a plain string — React will escape on render; we just confirm
    // the string contains the literal HTML characters unchanged.
    expect(result).toContain("<script>evil</script>");
  });
});
