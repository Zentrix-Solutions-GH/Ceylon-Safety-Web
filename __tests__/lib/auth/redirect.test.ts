import { describe, it, expect } from "vitest";
import { safeNext } from "@/lib/auth/redirect";

describe("safeNext", () => {
  it("returns a relative path as-is", () => {
    expect(safeNext("/dashboard")).toBe("/dashboard");
  });

  it("returns a relative path with query string", () => {
    expect(safeNext("/search?q=test")).toBe("/search?q=test");
  });

  it("returns / for absolute URL with external host", () => {
    expect(safeNext("https://evil.com/steal")).toBe("/");
  });

  it("returns / for protocol-relative URL", () => {
    expect(safeNext("//evil.com/steal")).toBe("/");
  });

  it("returns / for backslash trick: /\\evil.com", () => {
    expect(safeNext("/\\evil.com")).toBe("/");
  });

  it("returns / for javascript: scheme", () => {
    expect(safeNext("javascript:alert(1)")).toBe("/");
  });

  it("returns / for empty string", () => {
    expect(safeNext("")).toBe("/");
  });

  it("returns / for a very long string", () => {
    expect(safeNext("a".repeat(10000))).toBe("/");
  });

  it("returns / for null byte in path", () => {
    expect(safeNext("/admin\0bad")).toBe("/");
  });

  it("normalizes a path traversal to a valid path (/../admin → /admin)", () => {
    // URL.pathname normalizes /../admin to /admin — this is a safe relative path
    expect(safeNext("/../admin")).toBe("/admin");
  });

  it("returns / for data: URL", () => {
    expect(safeNext("data:text/html,<script>")).toBe("/");
  });

  it("returns / for undefined/null-ish input", () => {
    expect(safeNext(undefined as unknown as string)).toBe("/");
    expect(safeNext(null as unknown as string)).toBe("/");
  });
});
