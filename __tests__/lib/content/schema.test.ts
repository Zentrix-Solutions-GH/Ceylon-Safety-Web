// S-054: lib/content/schema — AC5/AC7 blockquote + link scheme validation

import { describe, it, expect } from "vitest";
import { validateBody, SCHEMA_VERSION } from "@/lib/content/schema";

function makeBody(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: SCHEMA_VERSION,
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }],
    ...overrides,
  };
}

function makeLink(href: string) {
  return makeBody({
    content: [{
      type: "paragraph",
      content: [{ type: "text", text: "click", marks: [{ type: "link", attrs: { href } }] }],
    }],
  });
}

describe("validateBody — AC5: blockquote block type", () => {
  it("accepts a blockquote block (Quote style)", () => {
    const result = validateBody(makeBody({
      content: [{
        type: "blockquote",
        content: [{ type: "paragraph", content: [{ type: "text", text: "a quote" }] }],
      }],
    }));
    expect(result.ok).toBe(true);
  });
});

describe("validateBody — AC7: link scheme validation", () => {
  it("accepts https:// link", () => {
    const result = validateBody(makeLink("https://example.com/page"));
    expect(result.ok).toBe(true);
  });

  it("accepts http:// link", () => {
    const result = validateBody(makeLink("http://example.com/page"));
    expect(result.ok).toBe(true);
  });

  it("refuses javascript: scheme", () => {
    const result = validateBody(makeLink("javascript:alert(1)"));
    expect(result.ok).toBe(false);
    expect((result as { ok: false; reason: string }).reason).toMatch(/scheme/i);
  });

  it("refuses data: scheme", () => {
    const result = validateBody(makeLink("data:text/html,<h1>hi</h1>"));
    expect(result.ok).toBe(false);
    expect((result as { ok: false; reason: string }).reason).toMatch(/scheme/i);
  });

  it("refuses mailto: in article body", () => {
    const result = validateBody(makeLink("mailto:user@example.com"));
    expect(result.ok).toBe(false);
    expect((result as { ok: false; reason: string }).reason).toMatch(/scheme/i);
  });

  it("refuses URL with credentials (user@host pattern)", () => {
    const result = validateBody(makeLink("https://good.com@evil.com"));
    expect(result.ok).toBe(false);
    expect((result as { ok: false; reason: string }).reason).toMatch(/credential/i);
  });

  it("refuses URL with password", () => {
    const result = validateBody(makeLink("https://user:pass@example.com"));
    expect(result.ok).toBe(false);
    expect((result as { ok: false; reason: string }).reason).toMatch(/credential/i);
  });

  it("EC3: refuses bare path (no scheme) as a link", () => {
    const result = validateBody(makeLink("/internal-path"));
    expect(result.ok).toBe(false);
  });
});
