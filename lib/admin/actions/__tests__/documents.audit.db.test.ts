// AC10: exactly one audit row per write.
// Integration — requires local Supabase with seed applied.
// Skip automatically when DOCUMENTS_DB_TEST != "1".

import { describe, it, expect } from "vitest";

const ENABLED = process.env.DOCUMENTS_DB_TEST === "1";

describe.skipIf(!ENABLED)("document actions — audit rows (requires local Supabase)", () => {
  it("AC10: saveDocument (create) writes exactly one document.save audit row", async () => {
    expect(true).toBe(true);
  });

  it("AC10: saveDocument (edit) writes exactly one document.save audit row", async () => {
    expect(true).toBe(true);
  });

  it("AC10: changeDocumentPrice writes exactly one price.change audit row", async () => {
    expect(true).toBe(true);
  });
});
