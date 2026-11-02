// @vitest-environment node
// S-038 AC7: Rows naming a Super Admin (as actor or target) are hidden from
// non-Super-Admin staff. Enforced by S-019 RLS; asserted here.
//
// Requires the local Supabase stack to be running:
//   npx supabase start && npx supabase db reset
//   npx vitest run supabase/tests/audit-visibility.test.ts
//
// SKIPPED automatically when env vars are absent.

import { describe, it, expect, beforeAll, afterAll } from "vitest";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const STACK_AVAILABLE = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_KEY);

let createClient: typeof import("@supabase/supabase-js").createClient;

// User IDs created during the test — cleaned up in afterAll.
const createdUserIds: string[] = [];

beforeAll(async () => {
  if (!STACK_AVAILABLE) return;
  ({ createClient } = await import("@supabase/supabase-js"));
});

afterAll(async () => {
  if (!STACK_AVAILABLE || !createClient) return;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  for (const id of createdUserIds) {
    await admin.auth.admin.deleteUser(id);
  }
});


describe("audit_visibility RLS (AC7)", () => {
  it.skipIf(!STACK_AVAILABLE)("non-Super-Admin cannot read rows where actor is a Super Admin", async () => {
    const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);

    // Create a Super Admin and an Admin user
    const saEmail = `sa-actor-${Date.now()}@test.local`;
    const adminEmail = `admin-reader-${Date.now()}@test.local`;

    const { data: saUser } = await adminClient.auth.admin.createUser({
      email: saEmail, password: "Test1234!", email_confirm: true,
    });
    createdUserIds.push(saUser!.user!.id);

    const { data: adminUser } = await adminClient.auth.admin.createUser({
      email: adminEmail, password: "Test1234!", email_confirm: true,
    });
    createdUserIds.push(adminUser!.user!.id);

    const saId = saUser!.user!.id;
    const adminId = adminUser!.user!.id;

    // Grant super_admin role to saId and admin role to adminId via service role
    await adminClient.from("user_roles").insert({ user_id: saId, role: "super_admin" });
    await adminClient.from("user_roles").insert({ user_id: adminId, role: "admin" });

    // Insert an audit row where the Super Admin is the actor — via service role
    const { error: insertErr } = await adminClient.from("admin_audit_log").insert({
      actor_id: saId,
      action: "article.publish",
      entity_type: "article",
      entity_id: "art-test-1",
    });
    expect(insertErr).toBeNull();

    // The Admin user should NOT see this row (SA as actor).
    // Sign in directly — the user was already created above; a second createUser
    // call with the same email would fail with a duplicate-email error.
    const { data: adminSession } = await createClient(SUPABASE_URL, ANON_KEY)
      .auth.signInWithPassword({ email: adminEmail, password: "Test1234!" });
    const adminToken = adminSession.session!.access_token;
    const adminAnon = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${adminToken}` } },
    });

    const { data: rows } = await adminAnon
      .from("admin_audit_log")
      .select("id")
      .eq("actor_id", saId);

    expect(rows).toHaveLength(0);
  });

  it.skipIf(!STACK_AVAILABLE)("non-Super-Admin cannot read rows where entity_id is a Super Admin", async () => {
    const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);

    const saEmail = `sa-target-${Date.now()}@test.local`;
    const adminEmail = `admin-reader2-${Date.now()}@test.local`;
    const actorEmail = `actor-${Date.now()}@test.local`;

    const { data: saUser } = await adminClient.auth.admin.createUser({
      email: saEmail, password: "Test1234!", email_confirm: true,
    });
    createdUserIds.push(saUser!.user!.id);

    const { data: adminUser } = await adminClient.auth.admin.createUser({
      email: adminEmail, password: "Test1234!", email_confirm: true,
    });
    createdUserIds.push(adminUser!.user!.id);

    const { data: actorUser } = await adminClient.auth.admin.createUser({
      email: actorEmail, password: "Test1234!", email_confirm: true,
    });
    createdUserIds.push(actorUser!.user!.id);

    const saId = saUser!.user!.id;
    const adminId = adminUser!.user!.id;
    const actorId = actorUser!.user!.id;

    await adminClient.from("user_roles").insert({ user_id: saId, role: "super_admin" });
    await adminClient.from("user_roles").insert({ user_id: adminId, role: "admin" });
    await adminClient.from("user_roles").insert({ user_id: actorId, role: "admin" });

    // Row where SA is the target (entity_id = saId, entity_type = 'profile')
    await adminClient.from("admin_audit_log").insert({
      actor_id: actorId,
      action: "permission.denied",
      entity_type: "profile",
      entity_id: saId,
    });

    // Sign in directly — adminEmail was already created above.
    const { data: adminSession2 } = await createClient(SUPABASE_URL, ANON_KEY)
      .auth.signInWithPassword({ email: adminEmail, password: "Test1234!" });
    const adminToken = adminSession2.session!.access_token;
    const adminAnon = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${adminToken}` } },
    });

    const { data: rows } = await adminAnon
      .from("admin_audit_log")
      .select("id")
      .eq("entity_id", saId);

    expect(rows).toHaveLength(0);
  });
});
