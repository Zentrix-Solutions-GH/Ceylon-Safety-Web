// S-048: lib/content/links — AC3/EC6 link policy

import { describe, it, expect } from "vitest";
import { checkLink } from "@/lib/content/links";

describe("checkLink — allowed", () => {
  it("allows https URL", () => {
    expect(checkLink("https://example.com/page").ok).toBe(true);
  });

  it("allows http URL", () => {
    expect(checkLink("http://example.com/page").ok).toBe(true);
  });
});

describe("checkLink — refused (EC6)", () => {
  it("refuses javascript: scheme", () => {
    expect(checkLink("javascript:alert(1)").ok).toBe(false);
  });

  it("refuses javascript: with tab character", () => {
    expect(checkLink("java\tscript:alert(1)").ok).toBe(false);
  });

  it("refuses upper-case JAVASCRIPT: scheme", () => {
    expect(checkLink("JAVASCRIPT:alert(1)").ok).toBe(false);
  });

  it("refuses data: URI", () => {
    expect(checkLink("data:text/html,<h1>hi</h1>").ok).toBe(false);
  });

  it("refuses protocol-relative //evil.com", () => {
    expect(checkLink("//evil.com").ok).toBe(false);
  });

  it("refuses /\\evil.com", () => {
    expect(checkLink("/\\evil.com").ok).toBe(false);
  });

  it("refuses URL with username credential", () => {
    expect(checkLink("https://good.com@evil.com").ok).toBe(false);
  });

  it("refuses URL over 2048 characters", () => {
    const long = "https://example.com/" + "a".repeat(2048);
    expect(checkLink(long).ok).toBe(false);
  });

  it("refuses mailto: in article bodies", () => {
    expect(checkLink("mailto:user@example.com").ok).toBe(false);
  });

  it("refuses tel: in article bodies", () => {
    expect(checkLink("tel:+94711234567").ok).toBe(false);
  });

  it("refuses internal path in article bodies", () => {
    expect(checkLink("/articles/fire-safety").ok).toBe(false);
  });

  it("refuses URL with control character", () => {
    expect(checkLink("https://example.com/\x00evil").ok).toBe(false);
  });

  it("refuses URL with hidden Unicode character", () => {
    // U+200B zero-width space
    expect(checkLink("https://example.com/​evil").ok).toBe(false);
  });

  it("includes the refused link in the error message", () => {
    const badUrl = "javascript:alert(1)";
    const result = checkLink(badUrl);
    expect(result.ok).toBe(false);
    expect((result as { ok: false; message: string }).message).toContain(badUrl);
  });
});
