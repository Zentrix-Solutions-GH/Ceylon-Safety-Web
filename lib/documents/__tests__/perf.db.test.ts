/**
 * S-071 EC6: Performance integration test — 10,000 documents, list stays within page limit.
 * Run with: npx vitest run --project integration  (requires local Supabase DB with perf seed)
 */
import { describe, it } from "vitest";

const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

describe("listPublicDocuments — 10,000-row performance (EC6)", () => {
  it.skipIf(!supabaseServiceKey)("EC6: response for 10,000 published documents returns exactly pageSize rows", async () => {
    // TODO(S-071): implement with perf seed data (10,000 published documents)
  });

  it.skipIf(!supabaseServiceKey)("EC6: sort=popular uses download_count index without seq scan", async () => {
    // TODO(S-071): implement with EXPLAIN ANALYZE via real DB
  });
});
