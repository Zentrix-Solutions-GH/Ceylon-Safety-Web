// S-079 AC8: The merchant secret must never appear in client bundles.
// This is enforced at the module boundary: lib/payhere/checkout.ts and
// lib/config.ts must import "server-only" so Next.js rejects any attempt
// to import them from a Client Component.
//
// The build-time check (grepping the .next/static bundle for the secret value)
// requires a production build and is documented in the story's Evidence section.
// This test verifies the structural guard: "server-only" is present in both files.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

const root = resolve(__dirname, "../../..");

describe("AC8: server-only scope guard", () => {
  it("lib/payhere/checkout.ts imports server-only", () => {
    const src = readFileSync(resolve(root, "lib/payhere/checkout.ts"), "utf-8");
    expect(src).toMatch(/import\s+["']server-only["']/);
  });

  it("lib/config.ts imports server-only", () => {
    const src = readFileSync(resolve(root, "lib/config.ts"), "utf-8");
    expect(src).toMatch(/import\s+["']server-only["']/);
  });

  it("types/payhere.ts does NOT import server-only (frontend must be able to import it)", () => {
    const src = readFileSync(resolve(root, "types/payhere.ts"), "utf-8");
    expect(src).not.toMatch(/import\s+["']server-only["']/);
  });
});
