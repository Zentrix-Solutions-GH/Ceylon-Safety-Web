// S-064: AC8 — performance test against seed data
//
// Requires: local Supabase running (`supabase start`) with the seed applied
// (at least 10,000 articles + documents combined).
//
// Skips automatically when the env var SEARCH_PERF_TEST is not set to "1",
// so it never blocks CI or normal `vitest run`.
//
// To run manually:
//   SEARCH_PERF_TEST=1 npx vitest run lib/search/__tests__/perf.db.test.ts
//
// The 2-second statement_timeout set in the migration is the runtime safety net;
// this test verifies the query returns within that bound on realistic data.

import { describe, it, expect } from "vitest";

const ENABLED = process.env.SEARCH_PERF_TEST === "1";

// 100-character query composed entirely of operators and rare terms.
// websearch_to_tsquery treats unknown words as search terms; with no matching
// rows the function returns quickly.  On seeded data with 10 000 rows it must
// still return in under 2 000 ms.
const OPERATOR_QUERY =
  "safety OR fire OR risk OR hazard OR chemical OR height OR confined OR electrical OR manual OR handling";

describe.skipIf(!ENABLED)("AC8 — performance: operator query on 10,000 rows", () => {
  it("100-char operator query finishes under 2 000 ms on seeded data", async () => {
    // Dynamic import so the module (and its server-only deps) load only when the
    // test is actually enabled — avoids import-time errors in normal runs.
    const { searchContent } = await import("@/lib/search/searchContent");

    const start = Date.now();
    const result = await searchContent(
      { scope: "home", query: OPERATOR_QUERY },
      "127.0.0.1"
    );
    const elapsed = Date.now() - start;

    expect(result.ok).toBe(true);
    expect(elapsed).toBeLessThan(2000);
  }, 5000); // 5 s vitest timeout — the statement_timeout is the 2 s hard limit
});
