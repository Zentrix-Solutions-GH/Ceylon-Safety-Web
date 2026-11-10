"use server";
import "server-only";

import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth/server";
import { requireStepUp } from "@/lib/auth/step-up";
import { writeAuditRow } from "@/lib/audit/index";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { StaffRole, StaffListItem } from "@/types/role";
import type {
  GrantRoleResult,
  RemoveRoleResult,
  ListStaffResult,
  FindUserByEmailResult,
} from "@/types/auth";

const GrantRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["admin", "editor"]),
  totpCode: z.string().min(6).max(8),
});

const RemoveRoleSchema = z.object({
  userId: z.string().uuid(),
  totpCode: z.string().min(6).max(8),
});

// ── grantRole ────────────────────────────────────────────────────────────────

/**
 * Grant 'admin' or 'editor' to a verified user.
 * Requires Super Admin caller + fresh TOTP step-up (AC1).
 */
export async function grantRole(input: {
  userId: string;
  role: string;
  totpCode: string;
}): Promise<GrantRoleResult> {
  const parsed = GrantRoleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "validation_failed" };
  }
  const { userId, role, totpCode } = parsed.data;

  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth;

  const serviceClient = createSupabaseServiceRoleClient();

  // EC1: validate target before consuming the TOTP window (step-up is irreversible)
  const { data: targetData, error: userErr } = await serviceClient.auth.admin.getUserById(userId);
  const targetUser = targetData?.user ?? null;

  if (userErr || !targetUser) {
    return { ok: false, code: "not_found" };
  }
  if (!targetUser.email_confirmed_at) {
    return { ok: false, code: "validation_failed" };
  }

  await requireStepUp(auth.user.id, totpCode);

  const { error: upsertErr } = await serviceClient
    .from("user_roles")
    .upsert(
      { user_id: userId, role, granted_by: auth.user.id },
      { onConflict: "user_id" }
    );

  if (upsertErr) {
    return { ok: false, code: "unknown" };
  }

  await writeAuditRow({
    actorId: auth.user.id,
    action: "role.change",
    entityType: "user",
    entityId: userId,
    after: { role } as Record<string, unknown>,
  });

  return { ok: true };
}

// ── removeRole ───────────────────────────────────────────────────────────────

/**
 * Remove the staff role from a user.
 * Cannot target a Super Admin or the caller's own row (AC2, AC3).
 */
export async function removeRole(input: {
  userId: string;
  totpCode: string;
}): Promise<RemoveRoleResult> {
  const parsed = RemoveRoleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "validation_failed" };
  }
  const { userId, totpCode } = parsed.data;

  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth;

  // AC3: cannot remove own role
  if (userId === auth.user.id) {
    return { ok: false, code: "not_allowed" };
  }

  const serviceClient = createSupabaseServiceRoleClient();

  // Fetch target's current role before consuming the TOTP window (step-up is irreversible)
  const { data: existing, error: fetchErr } = await serviceClient
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .single();

  if (fetchErr || !existing) {
    return { ok: false, code: "not_found" };
  }

  // AC3: cannot remove a Super Admin target
  if (existing.role === "super_admin") {
    return { ok: false, code: "not_allowed" };
  }

  await requireStepUp(auth.user.id, totpCode);

  const previousRole = existing.role as StaffRole;

  const { error: deleteErr } = await serviceClient
    .from("user_roles")
    .delete()
    .eq("user_id", userId);

  if (deleteErr) {
    return { ok: false, code: "unknown" };
  }

  await writeAuditRow({
    actorId: auth.user.id,
    action: "role.change",
    entityType: "user",
    entityId: userId,
    before: { role: previousRole } as Record<string, unknown>,
    after: { role: null } as Record<string, unknown>,
  });

  return { ok: true };
}

// ── listStaff ─────────────────────────────────────────────────────────────────

/**
 * List all Admin and Editor accounts with last sign-in and TOTP status.
 * Super Admin only (AC6).
 */
export async function listStaff(): Promise<ListStaffResult> {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth;

  const serviceClient = createSupabaseServiceRoleClient();

  // Step 1: get staff rows joined with profiles
  const { data: staffRows, error } = await serviceClient
    .from("user_roles")
    .select("user_id, role, profiles(email, last_sign_in_at)")
    .in("role", ["admin", "editor"]);

  if (error) {
    return { ok: false, code: "unknown" };
  }

  // Step 2: check TOTP per user via admin API (one call per row).
  // auth.admin has no bulk-get; staff count is bounded to O(10) in V1.
  // Revisit with a DB join on auth.users if staff grows beyond ~50.
  const staff: StaffListItem[] = await Promise.all(
    (staffRows ?? []).map(async (row) => {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;

      let hasTotpEnrolled = false;
      const { data: userData, error: userErr } = await serviceClient.auth.admin.getUserById(row.user_id);
      if (!userErr && userData?.user?.factors) {
        hasTotpEnrolled = userData.user.factors.some(
          (f) => f.factor_type === "totp" && f.status === "verified"
        );
      }

      return {
        userId: row.user_id,
        email: (profile as { email: string } | null)?.email ?? "",
        role: row.role as StaffRole,
        lastSignInAt: (profile as { last_sign_in_at: string | null } | null)?.last_sign_in_at ?? null,
        hasTotpEnrolled,
      };
    })
  );

  return { ok: true, staff };
}

// ── findUserByEmail ───────────────────────────────────────────────────────────

/**
 * Resolve an email address to a Supabase userId.
 * Super Admin only. Read-only — not audit-logged and no step-up required
 * (step-up is enforced on the subsequent grantRole write, not on this lookup).
 *
 * Limitation: listUsers is capped at 1000 results. Sites with >1000 Auth
 * users should replace this with a paginated loop or the getUserByEmail API
 * if Supabase exposes it. At current scale (<<1000 users) this is acceptable.
 * TODO: replace with paginated loop before 1000-user threshold is reached.
 */
export async function findUserByEmail(input: {
  email: string;
}): Promise<FindUserByEmailResult> {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth;

  const serviceClient = createSupabaseServiceRoleClient();

  const { data, error } = await serviceClient.auth.admin.listUsers({ perPage: 1000 });
  if (error) return { ok: false, code: "unknown" };

  const user = data.users.find(
    (u) => u.email?.toLowerCase() === input.email.toLowerCase()
  );
  if (!user) return { ok: false, code: "not_found" };

  return { ok: true, userId: user.id };
}
