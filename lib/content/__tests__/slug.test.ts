// S-048: lib/content/slug — AC6/EC3 slug generation rules

import { describe, it, expect } from "vitest";
import { generateSlug, RESERVED_SLUGS } from "@/lib/content/slug";

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
