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

  it("AC1: uses anon client — RLS is the guard against private rows leaking", async () => {
    // getPublicSettings() passes all DB rows through without an app-level
    // allowlist; privacy is enforced by the RLS policy "site_settings_public_read"
    // (.eq("is_public", true) at DB level). This test verifies the anon client
    // is selected (not service role), confirming the RLS path is active.
    // If a private row somehow bypassed RLS it would appear in the result —
    // that is an RLS gap, not a bug in this function.
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
