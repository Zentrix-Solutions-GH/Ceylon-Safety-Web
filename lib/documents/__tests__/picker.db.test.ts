/**
 * S-071 AC6: Integration tests for listDocumentPickerItems with real Supabase.
 * Run with: npx vitest run --project integration  (requires local Supabase DB)
 */
import { describe, it } from "vitest";

const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

describe("listDocumentPickerItems — picker permission (AC6)", () => {
  it.skipIf(!supabaseServiceKey)("staff with articles.* permission can list picker items", async () => {
    // TODO(S-071): implement with real DB seed
  });

  it.skipIf(!supabaseServiceKey)("customer (no staff role) cannot list picker items", async () => {
    // TODO(S-071): implement with real DB seed
  });

  it.skipIf(!supabaseServiceKey)("unauthenticated user cannot list picker items", async () => {
    // TODO(S-071): implement with real DB seed
  });
});
