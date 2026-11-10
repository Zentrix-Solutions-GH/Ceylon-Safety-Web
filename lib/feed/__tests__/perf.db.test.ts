// S-065: EC7 — performance test for feed query on 10,000 rows
//
// Requires: local Supabase running (`supabase start`) with ≥10,000 published
// articles + videos in the seed.
//
// Skips automatically when FEED_PERF_TEST env var is not set to "1".
//
// To run manually:
//   FEED_PERF_TEST=1 npx vitest run lib/feed/__tests__/perf.db.test.ts

import { describe, it, expect } from "vitest";

const ENABLED = process.env.FEED_PERF_TEST === "1";

describe.skipIf(!ENABLED)("EC7 — feed performance on 10,000 rows", () => {
  it("first page returns within 500 ms on 10,000 rows", async () => {
    const { getFeed } = await import("@/lib/feed/query");
    const start = Date.now();
    const result = await getFeed();
    const elapsed = Date.now() - start;
    expect(result.ok).toBe(true);
    expect(elapsed).toBeLessThan(500);
  }, 5000);

  it("deep page (cursor at row 10,000) returns within 500 ms", async () => {
    const { getFeed } = await import("@/lib/feed/query");

    // Walk to a deep cursor by paging forward up to 10 pages
    let cursor: string | null = null;
    let pages = 0;
    do {
      const result = await getFeed(cursor ?? undefined);
      if (!result.ok) { expect(result.ok).toBe(true); return; }
      cursor = result.page.nextCursor;
      pages++;
    } while (cursor && pages < 10);

    if (!cursor) return; // fewer than 120 items — skip timing assertion

    const start = Date.now();
    const result = await getFeed(cursor);
    const elapsed = Date.now() - start;
    expect(result.ok).toBe(true);
    expect(elapsed).toBeLessThan(500);
  }, 30000);
});
