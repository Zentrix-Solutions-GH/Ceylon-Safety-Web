/**
 * S-071 AC1, EC4: Integration tests for listPublicDocuments with real Supabase.
 * Run with: npx vitest run --project integration  (requires local Supabase DB)
 */
import { describe, it } from "vitest";

const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

describe("listPublicDocuments — filters and sort (AC1, EC4)", () => {
  it.skipIf(!supabaseServiceKey)("returns only published, non-deleted documents", async () => {
    // TODO(S-071): implement with real DB seed
  });

  it.skipIf(!supabaseServiceKey)("EC4: filter combination with no match returns empty list, not error", async () => {
    // TODO(S-071): implement with real DB seed
  });

  it.skipIf(!supabaseServiceKey)("EC6: 10,000-row page query stays within page limit", async () => {
    // TODO(S-071): implement with perf seed data
  });
});
