/**
 * S-071 AC3, AC4, EC1, EC5: Integration tests for getPublicDocument with real Supabase.
 * Run with: npx vitest run --project integration  (requires local Supabase DB)
 */
import { describe, it } from "vitest";

const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

describe("getPublicDocument — single read and redirect (AC3, EC5)", () => {
  it.skipIf(!supabaseServiceKey)("returns document for a known published slug", async () => {
    // TODO(S-071): implement with real DB seed
  });

  it.skipIf(!supabaseServiceKey)("EC5: returns redirect code for a slug found only in slug_redirects", async () => {
    // TODO(S-071): implement with real DB seed
  });

  it.skipIf(!supabaseServiceKey)("returns not_found for unknown slug", async () => {
    // TODO(S-071): implement with real DB seed
  });

  it.skipIf(!supabaseServiceKey)("AC4: document with no ready full file is listed as unavailable", async () => {
    // TODO(S-071): implement with real DB seed
  });

  it.skipIf(!supabaseServiceKey)("EC1: hidden document does not appear in single read", async () => {
    // TODO(S-071): implement with real DB seed
  });

  it.skipIf(!supabaseServiceKey)("EC1: deleted document does not appear in single read", async () => {
    // TODO(S-071): implement with real DB seed
  });
});
