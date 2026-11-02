// @vitest-environment node
// S-038 S15: admin_audit_log is append-only — UPDATE and DELETE must be blocked
// for all roles including service_role (enforced by the trigger / RLS policy).
//
// Requires the local Supabase stack to be running:
//   npx supabase start && npx supabase db reset
//   npx vitest run supabase/tests/audit-append-only.test.ts
//
// SKIPPED automatically when env vars are absent.

import { describe, it, expect, beforeAll, afterAll } from "vitest";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const STACK_AVAILABLE = Boolean(SUPABASE_URL && SERVICE_KEY);

let createClient: typeof import("@supabase/supabase-js").createClient;
let insertedRowId: string | null = null;

beforeAll(async () => {
  if (!STACK_AVAILABLE) return;
  ({ createClient } = await import("@supabase/supabase-js"));

  // Insert a seed row via service role so we have something to attempt to mutate.
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data, error } = await admin
    .from("admin_audit_log")
    .insert({
      actor_id: "00000000-0000-0000-0000-000000000001",
      action: "article.publish",
      entity_type: "article",
      entity_id: "append-only-test-row",
    })
    .select("id")
    .single();

  if (error) throw new Error(`seed insert failed: ${error.message}`);
  insertedRowId = data.id as string;
});

afterAll(async () => {
  // Intentionally do NOT delete the seed row — the whole point is it can't be deleted.
  // The local Supabase stack is reset between test runs anyway.
});

describe("admin_audit_log append-only (S15)", () => {
  it.skipIf(!STACK_AVAILABLE)("UPDATE on audit row is rejected", async () => {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { error } = await admin
      .from("admin_audit_log")
      .update({ action: "article.hide" })
      .eq("id", insertedRowId!);

    expect(error).not.toBeNull();
  });

  it.skipIf(!STACK_AVAILABLE)("DELETE on audit row is rejected", async () => {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { error } = await admin
      .from("admin_audit_log")
      .delete()
      .eq("id", insertedRowId!);

    expect(error).not.toBeNull();
  });
});
