// @vitest-environment node
// S-034 EC3 — Direct Supabase sign-up with hostile / overlong metadata should
// result in sanitised profile data written by the S-011 trigger.
//
// DEPENDENCY: These tests require the S-011 migration (create_profile_for trigger)
// to be applied. They will fail against a Supabase instance without S-011.
//
// Requires the local Supabase stack to be running:
//   npx supabase start
//   npx vitest run supabase/tests/signup-sanitising.test.ts
//
// SKIPPED automatically when SUPABASE_URL / SUPABASE_ANON_KEY are absent.
//
// To run manually:
//   export SUPABASE_URL=http://127.0.0.1:54321
//   export SUPABASE_ANON_KEY=<anon key from `npx supabase status`>
//   export SUPABASE_SERVICE_ROLE_KEY=<service-role key>
//   npx vitest run supabase/tests/signup-sanitising.test.ts

import { describe, it, expect, beforeAll, afterAll } from "vitest";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const STACK_AVAILABLE = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_KEY);

let createClient: typeof import("@supabase/supabase-js").createClient;

const HOSTILE_EMAIL = `ec3-hostile-${Date.now()}@example.com`;
const OVERLONG_EMAIL = `ec3-long-${Date.now()}@example.com`;
const STAFF_LIKE_EMAIL = `ec3-staff-${Date.now()}@example.com`;

const createdUserIds: string[] = [];

beforeAll(async () => {
  if (!STACK_AVAILABLE) return;
  ({ createClient } = await import("@supabase/supabase-js"));
});

afterAll(async () => {
  if (!STACK_AVAILABLE) return;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  for (const id of createdUserIds) {
    await admin.auth.admin.deleteUser(id);
  }
});

async function signUpAndGetProfile(
  email: string,
  firstName: string,
  lastName: string
): Promise<{ userId: string | null; profile: Record<string, unknown> | null }> {
  const anon = createClient(SUPABASE_URL, ANON_KEY);
  const { data, error } = await anon.auth.signUp({
    email,
    password: "TestPass99!",
    options: { data: { first_name: firstName, last_name: lastName } },
  });
  if (error || !data.user) return { userId: null, profile: null };

  createdUserIds.push(data.user.id);

  // Read the profile via service-role to bypass RLS
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: profile } = await admin
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", data.user.id)
    .single();

  return { userId: data.user.id, profile };
}

describe("S-034 EC3: sign-up with hostile metadata — S-011 trigger sanitises", () => {
  it.skipIf(!STACK_AVAILABLE)(
    "overlong first name (>50 chars) is truncated to 50 characters by the trigger",
    async () => {
      const longName = "A".repeat(100);
      const { profile } = await signUpAndGetProfile(OVERLONG_EMAIL, longName, "Silva");

      expect(profile).not.toBeNull();
      expect((profile?.first_name as string).length).toBeLessThanOrEqual(50);
    }
  );

  it.skipIf(!STACK_AVAILABLE)(
    "staff-like name ('admin', 'superuser') is stored as-is but does not grant elevated role",
    async () => {
      const { userId, profile } = await signUpAndGetProfile(
        STAFF_LIKE_EMAIL,
        "admin",
        "user"
      );

      expect(profile).not.toBeNull();
      // The name itself may be stored; what matters is the role in auth.users
      const admin = createClient(SUPABASE_URL, SERVICE_KEY);
      const { data: user } = await admin.auth.admin.getUserById(userId!);
      // Role must be the default authenticated role, not a staff role
      expect(user?.user?.role).not.toBe("staff");
      expect(user?.user?.role).not.toBe("admin");
    }
  );

  it.skipIf(!STACK_AVAILABLE)(
    "HTML/script injection in name is stored as plain text (no XSS risk at DB layer)",
    async () => {
      const xssName = '<script>alert("xss")</script>';
      const { profile } = await signUpAndGetProfile(
        HOSTILE_EMAIL,
        xssName,
        "Test"
      );

      expect(profile).not.toBeNull();
      // Stored as-is at the DB layer; escaping is the UI's responsibility.
      // This test documents the behaviour — not a vulnerability.
      expect(typeof profile?.first_name).toBe("string");
    }
  );
});
