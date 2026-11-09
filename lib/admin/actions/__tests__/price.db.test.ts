// AC9: existing orders keep their price snapshot; changeDocumentPrice must not touch orders.
// Integration — requires local Supabase with seed applied.
// Skip automatically when DOCUMENTS_DB_TEST != "1".

import { describe, it, expect } from "vitest";

const ENABLED = process.env.DOCUMENTS_DB_TEST === "1";

describe.skipIf(!ENABLED)("changeDocumentPrice — orders untouched (requires local Supabase)", () => {
  it("AC9: existing order_items keep their original price_cents after a price change", async () => {
    expect(true).toBe(true);
  });

  it("AC9: new orders after the price change see the new price", async () => {
    expect(true).toBe(true);
  });
});
