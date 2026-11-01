// @vitest-environment node
// S-034 EC2 — Re-signup with an unverified email and a different password.
// Requires the local Supabase stack to be running:
//   npx supabase start
//   npx vitest run supabase/tests/signup-integration.test.ts
//
// SKIPPED automatically when SUPABASE_URL / SUPABASE_ANON_KEY are absent.
//
// To run manually:
//   export SUPABASE_URL=http://127.0.0.1:54321
//   export SUPABASE_ANON_KEY=<anon key from `npx supabase status`>
//   export SUPABASE_SERVICE_ROLE_KEY=<service-role key>
//   npx vitest run supabase/tests/signup-integration.test.ts

import { describe, it, expect, beforeAll, afterAll } from "vitest";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const STACK_AVAILABLE = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_KEY);

let createClient: typeof import("@supabase/supabase-js").createClient;
const TEST_EMAIL = `ec2-test-${Date.now()}@example.com`;
const PASSWORD_1 = "FirstPass99!";
const PASSWORD_2 = "DifferentPass88!";

beforeAll(async () => {
  if (!STACK_AVAILABLE) return;
  ({ createClient } = await import("@supabase/supabase-js"));
});

afterAll(async () => {
  // Clean up the test user via the service-role client
  if (!STACK_AVAILABLE) return;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data } = await admin.auth.admin.listUsers();
  const user = data?.users?.find((u) => u.email === TEST_EMAIL);
  if (user) await admin.auth.admin.deleteUser(user.id);
});

describe("S-034 EC2: re-signup with unverified email", () => {
  it.skipIf(!STACK_AVAILABLE)(
    "first sign-up succeeds and leaves the email unverified",
    async () => {
      const anon = createClient(SUPABASE_URL, ANON_KEY);
      const { data, error } = await anon.auth.signUp({
        email: TEST_EMAIL,
        password: PASSWORD_1,
      });

      // Supabase returns a user object; email_confirmed_at should be null
      expect(error).toBeNull();
      expect(data.user).not.toBeNull();
      expect(data.user?.email_confirmed_at).toBeNull();
    }
  );

  it.skipIf(!STACK_AVAILABLE)(
    "second sign-up with the same unverified email and a different password returns a neutral result (AC3)",
    async () => {
      const anon = createClient(SUPABASE_URL, ANON_KEY);
      const { data, error } = await anon.auth.signUp({
        email: TEST_EMAIL,
        password: PASSWORD_2,
      });

      // Supabase Auth (with email confirmation ON) returns HTTP 200 and
      // user=null for a duplicate unverified sign-up — the new password is
      // silently ignored. This confirms AC3: the caller cannot tell whether
      // the email existed.
      // auth design §21 verify item 2.
      expect(error).toBeNull();
      // user may be null (existing unverified) or a duplicate session object —
      // either way no error code reveals the account.
      if (data.user !== null) {
        expect(data.user.email).toBe(TEST_EMAIL);
      }
    }
  );

  it.skipIf(!STACK_AVAILABLE)(
    "the original password remains valid after the second sign-up attempt",
    async () => {
      const anon = createClient(SUPABASE_URL, ANON_KEY);
      // The second sign-up must not overwrite the password of an unverified account
      // (Supabase silently ignores the duplicate; the first password stays).
      // We verify by attempting to sign in — this will fail until the email is
      // verified, which is expected: "Email not confirmed" error confirms the
      // account exists but the password change was not applied.
      const { error } = await anon.auth.signInWithPassword({
        email: TEST_EMAIL,
        password: PASSWORD_1,
      });
      // Expected: error.message contains "Email not confirmed" (not "Invalid login credentials")
      // "Invalid login credentials" would mean the password was overwritten.
      if (error) {
        expect(error.message).not.toContain("Invalid login credentials");
      }
    }
  );
});
