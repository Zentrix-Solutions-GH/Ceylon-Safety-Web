/**
 * AC8: Integration test — server permission map matches seeded role_permissions rows.
 *
 * Run with: npx vitest run --project integration  (requires a local Supabase DB)
 * The test queries the DB and compares against lib/auth/permissions.ts.
 */
import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { PERMISSION_MAP, SERVER_ONLY_PERMISSIONS } from "@/lib/auth/permissions";

const supabaseUrl = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

describe("permission map matches seeded role_permissions (AC8)", () => {
  it.skipIf(!supabaseServiceKey)("every non-server-only permission in PERMISSION_MAP has a matching row for the admin role", async () => {

    const client = createClient(supabaseUrl, supabaseServiceKey);

    const { data: rows, error } = await client
      .from("role_permissions")
      .select("role, action")
      .order("role")
      .order("action");

    expect(error).toBeNull();
    expect(rows).not.toBeNull();

    const seededAdminActions = new Set(
      (rows ?? []).filter((r) => r.role === "admin").map((r) => r.action)
    );

    const mapAdminActions = new Set(
      (PERMISSION_MAP.admin ?? []).filter((p) => !SERVER_ONLY_PERMISSIONS.includes(p))
    );

    // Every mapped admin permission should appear in the DB
    for (const action of mapAdminActions) {
      expect(seededAdminActions, `Missing from DB: ${action}`).toContain(action);
    }

    // Every seeded admin row should appear in the map
    for (const action of seededAdminActions) {
      expect(mapAdminActions, `DB has extra row not in map: ${action}`).toContain(action);
    }
  });

  it.skipIf(!supabaseServiceKey)("Maintainer has no seeded role_permissions rows (deny-by-default assumption)", async () => {

    const client = createClient(supabaseUrl, supabaseServiceKey);

    const { data: rows, error } = await client
      .from("role_permissions")
      .select("role")
      .eq("role", "maintainer");

    expect(error).toBeNull();
    expect(rows).toHaveLength(0);
  });
});
