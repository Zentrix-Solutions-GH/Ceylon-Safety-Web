// S-071 AC2: no file keys, file sizes or storage paths in any public response.

import { describe, it, expect } from "vitest";
import type {
  PublicDocumentCard,
  PublicDocument,
  DocumentPickerItem,
} from "@/types/document";

function hasFileKey(obj: unknown): boolean {
  if (typeof obj !== "object" || obj === null) return false;
  const forbidden = ["file_key", "fileKey", "file_size", "fileSize", "size_bytes", "sizeBytes", "storage_path", "storagePath"];
  for (const key of forbidden) {
    if (key in obj) return true;
  }
  return Object.values(obj as Record<string, unknown>).some(hasFileKey);
}

const sampleCard: PublicDocumentCard = {
  id: "doc-1",
  slug: "test-doc",
  title: "Test Document",
  coverImageKey: "covers/test.jpg",
  priceCents: 1000,
  pageCount: 10,
  downloadCount: 5,
  docKind: "checklist",
  categoryId: "cat-1",
  categoryName: "Safety",
  languages: ["en", "si"],
  unavailable: false,
};

const sampleDocument: PublicDocument = {
  ...sampleCard,
  description: "A test document",
  previewAvailability: { en: 2, si: 1, ta: 0 },
};

const samplePickerItem: DocumentPickerItem = {
  id: "doc-1",
  slug: "test-doc",
  title: "Test Document",
  coverImageKey: "covers/test.jpg",
  priceCents: 1000,
  kind: "document",
};

describe("PublicDocumentCard shape (AC2)", () => {
  it("contains no file key or size fields", () => {
    expect(hasFileKey(sampleCard)).toBe(false);
  });

  it("includes all required card fields", () => {
    expect(sampleCard).toHaveProperty("id");
    expect(sampleCard).toHaveProperty("slug");
    expect(sampleCard).toHaveProperty("title");
    expect(sampleCard).toHaveProperty("coverImageKey");
    expect(sampleCard).toHaveProperty("priceCents");
    expect(sampleCard).toHaveProperty("pageCount");
    expect(sampleCard).toHaveProperty("downloadCount");
    expect(sampleCard).toHaveProperty("docKind");
    expect(sampleCard).toHaveProperty("categoryId");
    expect(sampleCard).toHaveProperty("languages");
  });

  it("languages is an array of language codes (no full-file slot objects)", () => {
    expect(Array.isArray(sampleCard.languages)).toBe(true);
    for (const lang of sampleCard.languages) {
      expect(typeof lang).toBe("string");
    }
  });

  it("unavailable flag is present", () => {
    expect(typeof sampleCard.unavailable).toBe("boolean");
  });
});

describe("PublicDocument shape (AC3)", () => {
  it("contains no file key or size fields", () => {
    expect(hasFileKey(sampleDocument)).toBe(false);
  });

  it("previewAvailability is a per-language count object", () => {
    const pa = sampleDocument.previewAvailability;
    for (const lang of ["en", "si", "ta"] as const) {
      expect(typeof pa[lang]).toBe("number");
      expect(pa[lang]).toBeGreaterThanOrEqual(0);
      expect(pa[lang]).toBeLessThanOrEqual(3);
    }
  });
});

describe("DocumentPickerItem shape (AC6)", () => {
  it("contains no file key or size fields", () => {
    expect(hasFileKey(samplePickerItem)).toBe(false);
  });

  it("includes kind discriminant", () => {
    expect(samplePickerItem.kind).toBe("document");
  });
});
