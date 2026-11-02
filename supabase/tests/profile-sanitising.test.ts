// @vitest-environment node
// S-037 AC2 — Writing a staff-like display name through updateProfile must result
// in "Member" (or "Member <suffix>") stored by the S-011 sanitise_profile trigger.
// NFKC normalisation and zero-width characters are handled at the DB layer.
//
// DEPENDENCY: S-011 migration (profiles_sanitise trigger) must be applied.
//
// Requires the local Supabase stack to be running:
//   npx supabase start
//   npx vitest run supabase/tests/profile-sanitising.test.ts
//
// SKIPPED automatically when SUPABASE_URL / SUPABASE_ANON_KEY are absent.
//
// To run manually:
//   export SUPABASE_URL=http://127.0.0.1:54321
//   export SUPABASE_ANON_KEY=<anon key from `npx supabase status`>
//   export SUPABASE_SERVICE_ROLE_KEY=<service-role key>
//   npx vitest run supabase/tests/profile-sanitising.test.ts

import { describe, it, expect, beforeAll, afterAll } from "vitest";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const STACK_AVAILABLE = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_KEY);

let createClient: typeof import("@supabase/supabase-js").createClient;

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

async function createTestUser(email: string): Promise<{ userId: string }> {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: "TestPass99!",
    email_confirm: true,
    user_metadata: { first_name: "Test", last_name: "User" },
  });
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);
  createdUserIds.push(data.user.id);
  return { userId: data.user.id };
}

async function setDisplayName(userId: string, displayName: string): Promise<string | null> {
  // Write directly via service role — simulates what updateProfile writes to profiles.display_name.
  // The sanitise_profile BEFORE UPDATE trigger fires and may rewrite the value.
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { error } = await admin
    .from("profiles")
    .update({ display_name: displayName })
    .eq("id", userId);

  if (error) throw new Error(`update failed: ${error.message}`);

  const { data: profile } = await admin
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .single();

  return (profile?.display_name as string) ?? null;
}

describe("S-037 AC2: staff-like display_name is rewritten to 'Member' by the DB trigger", () => {
  it.skipIf(!STACK_AVAILABLE)(
    "plain staff keyword 'admin' becomes 'Member' (or 'Member <suffix>')",
    async () => {
      const { userId } = await createTestUser(`ac2-admin-${Date.now()}@example.com`);
      const stored = await setDisplayName(userId, "admin");
      expect(stored).toMatch(/^Member/);
    }
  );

  it.skipIf(!STACK_AVAILABLE)(
    "word containing staff keyword 'support' becomes 'Member'",
    async () => {
      const { userId } = await createTestUser(`ac2-support-${Date.now()}@example.com`);
      const stored = await setDisplayName(userId, "support");
      expect(stored).toMatch(/^Member/);
    }
  );

  it.skipIf(!STACK_AVAILABLE)(
    "zero-width character injected into staff keyword is still caught ('a​dmin')",
    async () => {
      const { userId } = await createTestUser(`ac2-zwsp-${Date.now()}@example.com`);
      // U+200B ZERO WIDTH SPACE injected between 'a' and 'dmin'
      const stored = await setDisplayName(userId, "a​dmin");
      // The trigger normalises via NFKC + strip-zero-width before the is_staff_like check
      expect(stored).toMatch(/^Member/);
    }
  );

  it.skipIf(!STACK_AVAILABLE)(
    "ordinary non-staff display name is stored unchanged",
    async () => {
      const { userId } = await createTestUser(`ac2-normal-${Date.now()}@example.com`);
      const stored = await setDisplayName(userId, "Chamara P");
      expect(stored).toBe("Chamara P");
    }
  );
});
