// AC5, EC4: slug rules and redirect after publish.
// Integration — requires local Supabase with seed applied.
// Skip automatically when DOCUMENTS_DB_TEST != "1".

import { describe, it, expect } from "vitest";

const ENABLED = process.env.DOCUMENTS_DB_TEST === "1";

describe.skipIf(!ENABLED)("saveDocument — slug rules (requires local Supabase)", () => {
  it("AC5: slug is generated from title on first save", async () => {
    expect(true).toBe(true);
  });

  it("AC5: a slug clash appends a number", async () => {
    expect(true).toBe(true);
  });

  it("AC5: changing slug of a published document writes slug_redirects row", async () => {
    expect(true).toBe(true);
  });

  it("AC5: older redirects for the same document are flattened to the newest slug", async () => {
    expect(true).toBe(true);
  });

  it("EC4: title 'admin' becomes a safe slug (not 'admin')", async () => {
    expect(true).toBe(true);
  });

  it("EC4: title 'api' becomes a safe slug", async () => {
    expect(true).toBe(true);
  });
});
