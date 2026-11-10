// AC3, EC1–EC3: validation rules for saveDocument input.
// Unit tests — no DB or network required.

import { describe, it, expect } from "vitest";
import { saveDocumentSchema } from "@/lib/validation/document";

const VALID_BASE = {
  title: "Fire Safety Checklist",
  docKind: "checklist" as const,
  categoryId: "dd000001-0000-4000-8000-000000000001",
  priceLkr: 1500,
};

describe("saveDocumentSchema — title validation (EC2)", () => {
  it("accepts a valid title", () => {
    const r = saveDocumentSchema.safeParse(VALID_BASE);
    expect(r.success).toBe(true);
  });

  it("rejects an empty title", () => {
    const r = saveDocumentSchema.safeParse({ ...VALID_BASE, title: "" });
    expect(r.success).toBe(false);
  });

  it("rejects a title that is only spaces", () => {
    const r = saveDocumentSchema.safeParse({ ...VALID_BASE, title: "   " });
    expect(r.success).toBe(false);
  });

  it("rejects a title over 200 characters", () => {
    const r = saveDocumentSchema.safeParse({ ...VALID_BASE, title: "a".repeat(201) });
    expect(r.success).toBe(false);
  });

  it("accepts a title of exactly 200 characters", () => {
    const r = saveDocumentSchema.safeParse({ ...VALID_BASE, title: "a".repeat(200) });
    expect(r.success).toBe(true);
  });

  it("strips surrounding whitespace from title", () => {
    const r = saveDocumentSchema.safeParse({ ...VALID_BASE, title: "  Hello  " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.title).toBe("Hello");
  });
});

describe("saveDocumentSchema — docKind validation (EC3)", () => {
  it("accepts checklist", () => {
    const r = saveDocumentSchema.safeParse({ ...VALID_BASE, docKind: "checklist" });
    expect(r.success).toBe(true);
  });

  it("accepts safety_sign", () => {
    const r = saveDocumentSchema.safeParse({ ...VALID_BASE, docKind: "safety_sign" });
    expect(r.success).toBe(true);
  });

  it("accepts toolbox_talk", () => {
    const r = saveDocumentSchema.safeParse({ ...VALID_BASE, docKind: "toolbox_talk" });
    expect(r.success).toBe(true);
  });

  it("rejects an unknown docKind", () => {
    const r = saveDocumentSchema.safeParse({ ...VALID_BASE, docKind: "unknown_type" });
    expect(r.success).toBe(false);
  });
});

describe("saveDocumentSchema — price validation (EC1)", () => {
  it("accepts price 1 (minimum)", () => {
    const r = saveDocumentSchema.safeParse({ ...VALID_BASE, priceLkr: 1 });
    expect(r.success).toBe(true);
  });

  it("rejects price 0", () => {
    const r = saveDocumentSchema.safeParse({ ...VALID_BASE, priceLkr: 0 });
    expect(r.success).toBe(false);
  });

  it("rejects negative price", () => {
    const r = saveDocumentSchema.safeParse({ ...VALID_BASE, priceLkr: -100 });
    expect(r.success).toBe(false);
  });

  it("rejects decimal price", () => {
    const r = saveDocumentSchema.safeParse({ ...VALID_BASE, priceLkr: 1.5 });
    expect(r.success).toBe(false);
  });

  it("rejects string price (type coercion off)", () => {
    const r = saveDocumentSchema.safeParse({ ...VALID_BASE, priceLkr: "1500" });
    expect(r.success).toBe(false);
  });
});

describe("saveDocumentSchema — categoryId validation (EC3)", () => {
  it("rejects an invalid uuid", () => {
    const r = saveDocumentSchema.safeParse({ ...VALID_BASE, categoryId: "not-a-uuid" });
    expect(r.success).toBe(false);
  });

  it("accepts a valid uuid", () => {
    const r = saveDocumentSchema.safeParse(VALID_BASE);
    expect(r.success).toBe(true);
  });
});

describe("saveDocumentSchema — optional fields", () => {
  it("accepts seoTitle up to 150 chars", () => {
    const r = saveDocumentSchema.safeParse({ ...VALID_BASE, seoTitle: "a".repeat(150) });
    expect(r.success).toBe(true);
  });

  it("rejects seoTitle over 150 chars", () => {
    const r = saveDocumentSchema.safeParse({ ...VALID_BASE, seoTitle: "a".repeat(151) });
    expect(r.success).toBe(false);
  });

  it("accepts null description", () => {
    const r = saveDocumentSchema.safeParse({ ...VALID_BASE, description: null });
    expect(r.success).toBe(true);
  });
});
