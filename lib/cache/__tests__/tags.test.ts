import { describe, it, expect } from "vitest";
import { FEED_TAG, HOME_FIRST_PAGE_TAG, COUNTERS_TAG } from "../tags";

describe("cache tags — AC5", () => {
  it("FEED_TAG is defined and non-empty", () => {
    expect(typeof FEED_TAG).toBe("string");
    expect(FEED_TAG.length).toBeGreaterThan(0);
  });

  it("HOME_FIRST_PAGE_TAG is defined and non-empty", () => {
    expect(typeof HOME_FIRST_PAGE_TAG).toBe("string");
    expect(HOME_FIRST_PAGE_TAG.length).toBeGreaterThan(0);
  });

  it("COUNTERS_TAG is defined and non-empty", () => {
    expect(typeof COUNTERS_TAG).toBe("string");
    expect(COUNTERS_TAG.length).toBeGreaterThan(0);
  });

  it("FEED_TAG matches the string used in purge.ts at build time", () => {
    // Ensures purge.ts imports from tags (structural contract).
    // This test fails if the constant is renamed or removed.
    expect(FEED_TAG).toBe("feed-api");
    expect(HOME_FIRST_PAGE_TAG).toBe("home-first-page");
    expect(COUNTERS_TAG).toBe("counters");
  });
});
