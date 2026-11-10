/**
 * S-071 AC5, EC2, EC3: Integration tests for GET /api/preview/[documentId] with real Supabase.
 * Run with: npx vitest run --project integration  (requires local Supabase DB)
 */
import { describe, it } from "vitest";

const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

describe("GET /api/preview/[documentId] — preview route integration (AC5, EC2, EC3)", () => {
  it.skipIf(!supabaseServiceKey)("AC5: serves current ready preview file for valid documentId, language, page", async () => {
    // TODO(S-071): implement with real DB seed + R2 test bucket
  });

  it.skipIf(!supabaseServiceKey)("EC2: documentId of another document's file returns not_found", async () => {
    // TODO(S-071): implement with real DB seed
  });

  it.skipIf(!supabaseServiceKey)("EC2: random UUID returns not_found with no hint of a full file", async () => {
    // TODO(S-071): implement with real DB seed
  });

  it.skipIf(!supabaseServiceKey)("EC3: missing preview for requested language returns not_found (no English fallback)", async () => {
    // TODO(S-071): implement with real DB seed
  });

  it.skipIf(!supabaseServiceKey)("AC5: never serves a full file even when documentId matches a full file row", async () => {
    // TODO(S-071): implement with real DB seed
  });
});
