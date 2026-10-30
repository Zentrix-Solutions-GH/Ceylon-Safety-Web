// @vitest-environment node
// AC6 — Integration test for the custom access token hook.
// Requires the local Supabase stack to be running:
//   npx supabase start
//   npx vitest run supabase/tests/claims-hook.test.ts
//
// This test is SKIPPED when SUPABASE_URL / SUPABASE_ANON_KEY are not set,
// so it does not block the unit-test CI run.
//
// To run manually:
//   export SUPABASE_URL=http://127.0.0.1:54321
//   export SUPABASE_ANON_KEY=<anon key from `npx supabase status`>
//   export SUPABASE_SERVICE_ROLE_KEY=<service-role key>
//   npx vitest run supabase/tests/claims-hook.test.ts

import { describe, it, expect, beforeAll, afterAll } from "vitest";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const STACK_AVAILABLE = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_KEY);

// Supabase JS client — imported lazily so the test file can load without it
// when running unit tests (the package is a devDependency).
let createClient: typeof import("@supabase/supabase-js").createClient;

beforeAll(async () => {
  if (!STACK_AVAILABLE) return;
  ({ createClient } = await import("@supabase/supabase-js"));
});

describe.skipIf(!STACK_AVAILABLE)(
  "S-031 AC6: claims hook adds user_role and account_status",
  () => {
    const testEmail = `claims-hook-test-${Date.now()}@ceylonsafety-test.invalid`;
    const testPassword = "TestPassword123!";
    let userId: string;

    afterAll(async () => {
      if (!STACK_AVAILABLE || !userId) return;
      // Clean up: delete test user via admin API
      const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      await admin.auth.admin.deleteUser(userId);
    });

    it("customer token has no user_role claim", async () => {
      const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      // Create user bypassing email confirmation (admin API)
      const { data, error } = await admin.auth.admin.createUser({
        email: testEmail,
        password: testPassword,
        email_confirm: true,
      });
      expect(error).toBeNull();
      userId = data.user!.id;

      // Sign in as the customer
      const client = createClient(SUPABASE_URL, ANON_KEY);
      const { data: signInData, error: signInError } =
        await client.auth.signInWithPassword({
          email: testEmail,
          password: testPassword,
        });
      expect(signInError).toBeNull();

      // Decode the JWT (no signature verification needed for local test)
      const token = signInData.session!.access_token;
      const payload = JSON.parse(
        Buffer.from(token.split(".")[1], "base64url").toString("utf8")
      );

      // A customer must NOT have user_role
      expect(payload.user_role).toBeUndefined();
      // account_status should be present (profiles row created by trigger)
      expect(payload.account_status).toBeDefined();
    });

    it("staff token carries the correct user_role", async () => {
      const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      // Insert a user_roles row for this user (maintainer)
      const { error: roleError } = await admin
        .from("user_roles")
        .insert({ user_id: userId, role: "maintainer" });
      expect(roleError).toBeNull();

      // Re-sign in to get a fresh token with updated claims
      const client = createClient(SUPABASE_URL, ANON_KEY);
      const { data: signInData, error: signInError } =
        await client.auth.signInWithPassword({
          email: testEmail,
          password: testPassword,
        });
      expect(signInError).toBeNull();

      const token = signInData.session!.access_token;
      const payload = JSON.parse(
        Buffer.from(token.split(".")[1], "base64url").toString("utf8")
      );

      expect(payload.user_role).toBe("maintainer");
      expect(payload.account_status).toBe("active");
    });
  }
);

describe("S-031 AC6 (static): hook function grant is in the migration", () => {
  it("migration grants EXECUTE to supabase_auth_admin", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const migDir = path.resolve(__dirname, "../../supabase/migrations");
    const files = fs.readdirSync(migDir).filter((f) => f.endsWith(".sql"));
    const found = files.some((f) => {
      const src = fs.readFileSync(path.join(migDir, f), "utf8");
      return (
        src.includes("custom_access_token_hook") &&
        src.includes("supabase_auth_admin")
      );
    });
    expect(found).toBe(true);
  });
});
