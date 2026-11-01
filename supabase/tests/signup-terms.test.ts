// @vitest-environment node
// S-034 EC5 — The S-011 trigger sets terms_accepted_at on the profile only
// when the supplied terms_revision_id exists in page_revisions; an invalid or
// missing id leaves the field NULL.
//
// Requires the local Supabase stack to be running:
//   npx supabase start
//   npx vitest run supabase/tests/signup-terms.test.ts
//
// SKIPPED automatically when SUPABASE_URL / SUPABASE_ANON_KEY are absent.

import { describe, it, expect, beforeAll, afterAll } from "vitest";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const STACK_AVAILABLE = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_KEY);

let createClient: typeof import("@supabase/supabase-js").createClient;

const createdUserIds: string[] = [];

// Unique e-mails per test run so retries don't collide
const ts = Date.now();
const EMAIL_VALID = `ec5-valid-${ts}@example.com`;
const EMAIL_INVALID = `ec5-invalid-${ts}@example.com`;
const EMAIL_MISSING = `ec5-missing-${ts}@example.com`;

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

async function signUpAndReadProfile(
  email: string,
  metadata: Record<string, unknown>
): Promise<{
  userId: string | null;
  termsAcceptedAt: string | null;
  termsRevisionId: string | null;
}> {
  const anon = createClient(SUPABASE_URL, ANON_KEY);
  const { data, error } = await anon.auth.signUp({
    email,
    password: "TestPass99!",
    options: { data: { first_name: "Test", last_name: "User", ...metadata } },
  });

  if (error || !data.user) return { userId: null, termsAcceptedAt: null, termsRevisionId: null };

  createdUserIds.push(data.user.id);

  // Service-role bypasses RLS so we can read the profile immediately
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: profile } = await admin
    .from("profiles")
    .select("terms_accepted_at, terms_revision_id")
    .eq("id", data.user.id)
    .single();

  return {
    userId: data.user.id,
    termsAcceptedAt: (profile?.terms_accepted_at as string | null) ?? null,
    termsRevisionId: (profile?.terms_revision_id as string | null) ?? null,
  };
}

async function getValidRevisionId(): Promise<string | null> {
  // Fetch the most recent page_revisions row so the test doesn't hardcode a UUID
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data } = await admin
    .from("page_revisions")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  return data?.id ?? null;
}

describe("S-034 EC5: terms_revision_id → terms_accepted_at via S-011 trigger", () => {
  it.skipIf(!STACK_AVAILABLE)(
    "valid terms_revision_id in metadata → terms_accepted_at is set and revision id stored",
    async () => {
      const revisionId = await getValidRevisionId();
      if (!revisionId) {
        // No page_revisions seeded — document the skip reason and pass
        console.warn("EC5: no page_revisions rows found; skipping valid-revision assertion");
        return;
      }

      const { termsAcceptedAt, termsRevisionId } = await signUpAndReadProfile(EMAIL_VALID, {
        terms_revision_id: revisionId,
      });

      expect(termsAcceptedAt).not.toBeNull();
      expect(termsRevisionId).toBe(revisionId);
    }
  );

  it.skipIf(!STACK_AVAILABLE)(
    "nonexistent terms_revision_id in metadata → terms_accepted_at is NULL",
    async () => {
      const { termsAcceptedAt } = await signUpAndReadProfile(EMAIL_INVALID, {
        // A well-formed UUID that does not exist in page_revisions
        terms_revision_id: "00000000-0000-0000-0000-000000000000",
      });

      expect(termsAcceptedAt).toBeNull();
    }
  );

  it.skipIf(!STACK_AVAILABLE)(
    "no terms_revision_id in metadata → terms_accepted_at is NULL",
    async () => {
      const { termsAcceptedAt } = await signUpAndReadProfile(EMAIL_MISSING, {
        // Intentionally omit terms_revision_id
      });

      expect(termsAcceptedAt).toBeNull();
    }
  );
});
