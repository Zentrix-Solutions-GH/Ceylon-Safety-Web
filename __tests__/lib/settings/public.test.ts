// S-099: Public settings integration tests — AC1, analyst-gap: unauthenticated call
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAnonClient: vi.fn(),
}));

import { createSupabaseAnonClient } from "@/lib/supabase/server";
import { getPublicSettings } from "@/lib/settings/public";

function makeDb(rows: Array<{ key: string; value: unknown }>) {
  const chain: Record<string, unknown> = {
    select: () => chain,
    eq: () => chain,
    then(resolve: (v: unknown) => unknown) {
      return Promise.resolve({ data: rows, error: null }).then(resolve);
    },
    catch(reject: (e: unknown) => unknown) {
      return Promise.resolve({ data: rows, error: null }).catch(reject);
    },
  };
  return { from: () => chain };
}

describe("getPublicSettings", () => {
  beforeEach(() => {
    vi.mocked(createSupabaseAnonClient).mockClear();
  });

  it("AC1: returns only is_public rows from anon client (no auth required)", async () => {
    const rows = [
      { key: "footer_business_name", value: "CeylonSafety" },
      { key: "bulk_contact_note", value: "Call us" },
      { key: "contact_email", value: "info@ceylonsafety.lk" },
    ];
    vi.mocked(createSupabaseAnonClient).mockReturnValue(makeDb(rows) as never);

    const result = await getPublicSettings();
    expect(result).toEqual({
      footer_business_name: "CeylonSafety",
      bulk_contact_note: "Call us",
      contact_email: "info@ceylonsafety.lk",
    });
  });

  it("AC1: does not expose private keys (private rows are filtered by DB RLS)", async () => {
    // The anon client only gets is_public=true rows via RLS policy.
    // If a private key somehow appears, it still passes through (RLS is the guard).
    // This test verifies the anon client is used (not service role).
    vi.mocked(createSupabaseAnonClient).mockReturnValue(makeDb([]) as never);
    await getPublicSettings();
    expect(createSupabaseAnonClient).toHaveBeenCalledTimes(1);
  });

  it("AC1: returns empty object when no public rows exist", async () => {
    vi.mocked(createSupabaseAnonClient).mockReturnValue(makeDb([]) as never);
    const result = await getPublicSettings();
    expect(result).toEqual({});
  });

  it("AC1: null values are included in result", async () => {
    vi.mocked(createSupabaseAnonClient).mockReturnValue(
      makeDb([{ key: "bulk_contact_phone", value: null }]) as never
    );
    const result = await getPublicSettings();
    expect(result).toHaveProperty("bulk_contact_phone", null);
  });
});
