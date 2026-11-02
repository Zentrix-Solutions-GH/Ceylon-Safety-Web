// @vitest-environment node
// AC6/EC1: Cache-Control: no-store and X-Robots-Tag must be present even when
// the middleware matcher is broken — they come from next.config.ts static headers.
// This test verifies the next.config.ts header rules independently of middleware.
import { describe, it, expect } from "vitest";

// next.config.ts builds static headers using lib/security/headers.ts
// We test buildStaticHeaders directly to confirm the double-protection exists.
import { buildStaticHeaders } from "../lib/security/headers";

const PRIVATE_PATHS = [
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/admin",
  "/admin/dashboard",
  "/cart",
  "/checkout/payment",
  "/download/abc",
  "/purchases",
  "/profile",
  "/profile/settings",
  "/api/cart/items",
];

describe("EC1 / AC6 — static headers in next.config.ts cover private paths", () => {
  for (const path of PRIVATE_PATHS) {
    it(`${path} → Cache-Control: no-store present`, () => {
      const headers = buildStaticHeaders(path);
      const cc = headers.find((h) => h.key === "Cache-Control");
      expect(cc).toBeDefined();
      expect(cc?.value).toBe("no-store");
    });

    it(`${path} → X-Robots-Tag: noindex present`, () => {
      const headers = buildStaticHeaders(path);
      const robots = headers.find((h) => h.key === "X-Robots-Tag");
      expect(robots).toBeDefined();
      expect(robots?.value).toMatch(/noindex/);
    });
  }
});

describe("EC1 — public pages do NOT get private headers in next.config.ts", () => {
  const PUBLIC_PATHS = ["/", "/articles", "/articles/safety-tips", "/documents", "/search"];

  for (const path of PUBLIC_PATHS) {
    it(`${path} → no Cache-Control: no-store`, () => {
      const headers = buildStaticHeaders(path);
      const cc = headers.find((h) => h.key === "Cache-Control");
      expect(cc).toBeUndefined();
    });
  }
});
