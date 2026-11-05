// S-048: lib/content/schema — AC2/EC5 body validation limits

import { describe, it, expect } from "vitest";
import {
  validateBody,
  SCHEMA_VERSION,
  MAX_BODY_BYTES,
  MAX_TOP_BLOCKS,
  MAX_LINKS,
  MAX_LINK_LENGTH,
  ALLOWED_FONTS,
} from "@/lib/content/schema";

function makeBody(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: SCHEMA_VERSION,
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }],
    ...overrides,
  };
}

describe("validateBody", () => {
  it("accepts a minimal valid body", () => {
    const result = validateBody(makeBody());
    expect(result.ok).toBe(true);
  });

  it("requires schema_version", () => {
    const body = makeBody();
    delete (body as Record<string, unknown>).schema_version;
    const result = validateBody(body);
    expect(result.ok).toBe(false);
    expect((result as { ok: false; reason: string }).reason).toMatch(/schema_version/);
  });

  it("EC5: refuses body over 1 MB text length", () => {
    const big = "x".repeat(MAX_BODY_BYTES + 1);
    const body = makeBody({
      content: [{ type: "paragraph", content: [{ type: "text", text: big }] }],
    });
    const result = validateBody(body);
    expect(result.ok).toBe(false);
    expect((result as { ok: false; reason: string }).reason).toMatch(/size/i);
  });

  it("EC5: refuses more than 80 top-level blocks", () => {
    const blocks = Array.from({ length: MAX_TOP_BLOCKS + 1 }, () => ({
      type: "paragraph",
      content: [{ type: "text", text: "a" }],
    }));
    const result = validateBody(makeBody({ content: blocks }));
    expect(result.ok).toBe(false);
    expect((result as { ok: false; reason: string }).reason).toMatch(/block/i);
  });

  it("EC5: refuses lists nested more than 3 deep (4 levels = invalid)", () => {
    // 3 levels is the max (allowed). 4 levels must fail.
    const deepList = {
      type: "bulletList",           // level 1
      content: [{
        type: "listItem",
        content: [{
          type: "bulletList",       // level 2
          content: [{
            type: "listItem",
            content: [{
              type: "bulletList",   // level 3
              content: [{
                type: "listItem",
                content: [{
                  type: "bulletList",  // level 4 — exceeds limit
                  content: [{
                    type: "listItem",
                    content: [{ type: "paragraph", content: [{ type: "text", text: "too deep" }] }],
                  }],
                }],
              }],
            }],
          }],
        }],
      }],
    };
    const result = validateBody(makeBody({ content: [deepList] }));
    expect(result.ok).toBe(false);
    expect((result as { ok: false; reason: string }).reason).toMatch(/nest/i);
  });

  it("EC5: refuses more than 100 links", () => {
    // 101 links spread across 2 paragraphs (stays within 80-block limit)
    const linksInPara = Array.from({ length: MAX_LINKS + 1 }, (_, i) => ({
      type: "text",
      text: `link${i}`,
      marks: [{ type: "link", attrs: { href: `https://example.com/${i}` } }],
    }));
    const result = validateBody(makeBody({
      content: [{ type: "paragraph", content: linksInPara }],
    }));
    expect(result.ok).toBe(false);
    expect((result as { ok: false; reason: string }).reason).toMatch(/link/i);
  });

  it("EC5: refuses a link over 2048 characters", () => {
    const longUrl = "https://example.com/" + "a".repeat(MAX_LINK_LENGTH);
    const body = makeBody({
      content: [{
        type: "paragraph",
        content: [{
          type: "text",
          text: "click",
          marks: [{ type: "link", attrs: { href: longUrl } }],
        }],
      }],
    });
    const result = validateBody(body);
    expect(result.ok).toBe(false);
    expect((result as { ok: false; reason: string }).reason).toMatch(/link/i);
  });

  it("refuses an unknown block type", () => {
    const result = validateBody(makeBody({
      content: [{ type: "unknownBlock", content: [] }],
    }));
    expect(result.ok).toBe(false);
    expect((result as { ok: false; reason: string }).reason).toMatch(/unknown/i);
  });

  it("refuses an unknown mark type", () => {
    const result = validateBody(makeBody({
      content: [{
        type: "paragraph",
        content: [{ type: "text", text: "hi", marks: [{ type: "scriptMark" }] }],
      }],
    }));
    expect(result.ok).toBe(false);
    expect((result as { ok: false; reason: string }).reason).toMatch(/unknown/i);
  });

  it("refuses a named font not in the allow-list", () => {
    const result = validateBody(makeBody({
      content: [{
        type: "paragraph",
        content: [{
          type: "text",
          text: "styled",
          marks: [{ type: "namedFont", attrs: { font: "EvilFont" } }],
        }],
      }],
    }));
    expect(result.ok).toBe(false);
    expect((result as { ok: false; reason: string }).reason).toMatch(/font/i);
  });

  it("accepts named fonts in the allow-list", () => {
    for (const font of ALLOWED_FONTS) {
      const result = validateBody(makeBody({
        content: [{
          type: "paragraph",
          content: [{
            type: "text",
            text: "styled",
            marks: [{ type: "namedFont", attrs: { font } }],
          }],
        }],
      }));
      expect(result.ok).toBe(true);
    }
  });

  it("accepts an image block", () => {
    const result = validateBody(makeBody({
      content: [{
        type: "image",
        attrs: { node_id: "n1", key: "img/abc.webp", alt: "a photo" },
      }],
    }));
    expect(result.ok).toBe(true);
  });

  it("accepts a decorative image block", () => {
    const result = validateBody(makeBody({
      content: [{
        type: "image",
        attrs: { node_id: "n1", key: "img/abc.webp", decorative: true },
      }],
    }));
    expect(result.ok).toBe(true);
  });

  it("accepts a video block", () => {
    const result = validateBody(makeBody({
      content: [{
        type: "video",
        attrs: { node_id: "n2", video_id: "00000000-0000-4000-8000-000000000001" },
      }],
    }));
    expect(result.ok).toBe(true);
  });

  it("accepts a document_spot block", () => {
    const result = validateBody(makeBody({
      content: [{
        type: "document_spot",
        attrs: { node_id: "n3", document_id: "00000000-0000-4000-8000-000000000002" },
      }],
    }));
    expect(result.ok).toBe(true);
  });

  it("accepts a course_spot block", () => {
    const result = validateBody(makeBody({
      content: [{
        type: "course_spot",
        attrs: { node_id: "n4", course_id: "00000000-0000-4000-8000-000000000003" },
      }],
    }));
    expect(result.ok).toBe(true);
  });

  it("EC4: script tags in text node are stored as plain text, not executed", () => {
    const result = validateBody(makeBody({
      content: [{
        type: "paragraph",
        content: [{ type: "text", text: "<script>alert(1)</script>" }],
      }],
    }));
    // A text node with script content is valid (stored as data, rendered as text)
    expect(result.ok).toBe(true);
  });
});
