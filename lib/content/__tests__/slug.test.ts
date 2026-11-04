// S-048: lib/content/slug — AC6/EC3 slug generation rules

import { describe, it, expect } from "vitest";
import { generateSlug, clashSafeSlug, RESERVED_SLUGS } from "@/lib/content/slug";

describe("generateSlug", () => {
  it("lowercases the title", () => {
    expect(generateSlug("Fire Safety")).toBe("fire-safety");
  });

  it("replaces spaces with hyphens", () => {
    expect(generateSlug("fire safety tips")).toBe("fire-safety-tips");
  });

  it("removes accented characters", () => {
    expect(generateSlug("Sécurité incendie")).toBe("securite-incendie");
  });

  it("removes symbols", () => {
    expect(generateSlug("Fire & Safety!")).toBe("fire-safety");
  });

  it("truncates to 80 characters", () => {
    const title = "a ".repeat(60); // 120 chars
    expect(generateSlug(title).length).toBeLessThanOrEqual(80);
  });

  it("EC3: Sinhala-only title falls back to a short random id", () => {
    const slug = generateSlug("ගිනි ආරක්ෂාව");
    // Should not be empty and should be a short random id (not Sinhala chars)
    expect(slug.length).toBeGreaterThan(0);
    expect(slug).toMatch(/^[a-z0-9-]+$/);
  });

  it("EC3: empty-after-cleaning title falls back to a short random id", () => {
    const slug = generateSlug("!!! ###");
    expect(slug.length).toBeGreaterThan(0);
    expect(slug).toMatch(/^[a-z0-9-]+$/);
  });

  it("strips leading and trailing hyphens", () => {
    const slug = generateSlug("- fire -");
    expect(slug).not.toMatch(/^-|-$/);
  });

  it("collapses multiple hyphens into one", () => {
    const slug = generateSlug("fire  &  safety");
    expect(slug).not.toMatch(/--/);
  });
});

function makeSlugMock(existingRows: { id: string }[][]) {
  let call = -1;
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => {
            call++;
            return Promise.resolve({ data: existingRows[Math.min(call, existingRows.length - 1)], error: null });
          },
        }),
      }),
    }),
  };
}

describe("clashSafeSlug", () => {
  it("returns base slug when no clash exists", async () => {
    const sb = makeSlugMock([[]]);
    const result = await clashSafeSlug("fire-safety", null, "en", sb as never);
    expect(result).toBe("fire-safety");
  });

  it("appends -1 when base slug is taken by another article", async () => {
    const sb = makeSlugMock([[{ id: "other-id" }], []]);
    const result = await clashSafeSlug("fire-safety", null, "en", sb as never);
    expect(result).toBe("fire-safety-1");
  });

  it("retries until a free slot is found (clash on -1 too)", async () => {
    const sb = makeSlugMock([[{ id: "other-id" }], [{ id: "other-id-2" }], []]);
    const result = await clashSafeSlug("fire-safety", null, "en", sb as never);
    expect(result).toBe("fire-safety-2");
  });

  it("EC3: article being updated does not clash with its own slug", async () => {
    const ARTICLE_ID = "my-article-id";
    const sb = makeSlugMock([[{ id: ARTICLE_ID }]]);
    const result = await clashSafeSlug("fire-safety", ARTICLE_ID, "en", sb as never);
    expect(result).toBe("fire-safety");
  });
});

describe("RESERVED_SLUGS", () => {
  it("includes admin", () => {
    expect(RESERVED_SLUGS).toContain("admin");
  });

  it("includes api", () => {
    expect(RESERVED_SLUGS).toContain("api");
  });

  it("includes search", () => {
    expect(RESERVED_SLUGS).toContain("search");
  });

  it("includes new", () => {
    expect(RESERVED_SLUGS).toContain("new");
  });

  it("includes edit", () => {
    expect(RESERVED_SLUGS).toContain("edit");
  });

  it("includes preview", () => {
    expect(RESERVED_SLUGS).toContain("preview");
  });

  it("includes sign-in", () => {
    expect(RESERVED_SLUGS).toContain("sign-in");
  });
});
