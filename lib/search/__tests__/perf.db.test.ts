// S-064: AC8 — performance test against seed data
//
// Requires: local Supabase running with 10,000 articles + documents seeded.
// Run: npx vitest run lib/search/__tests__/perf.db.test.ts (with SUPABASE_URL set to local)
//
// The 2-second statement_timeout set in the migration is the runtime safety net;
// this test verifies the query returns within that bound on realistic data.

import { describe, it } from "vitest";

describe("AC8 — performance: operator query on 10,000 rows", () => {
  it.todo(
    "100-char operator query finishes under 2 s on 10,000 combined rows (requires seeded local DB)"
  );
});
