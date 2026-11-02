import "server-only";

import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { buildSessionUser, isWithinStaffWindow } from "@/lib/auth/claims";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import type { SessionUser, ActionResult, UserRole } from "@/types/auth";

type AuthResult<T = { user: SessionUser }> = ActionResult<T>;

// ─── getCurrentUser ───────────────────────────────────────────────────────────

/**
 * Returns the verified user or null. Never throws.
 * For private pages and server components only — never call from a public page (AC11).
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    return buildSessionUser(data.user);
  } catch {
    return null;
  }
}

// ─── requireUser ─────────────────────────────────────────────────────────────

/**
 * Requires a signed-in user. Creates the profiles row if missing (AC2).
 * Returns { ok: true, user } or { ok: false, code: 'reauth_required' }.
 * For pages, redirects to /sign-in (TODO: redirect wiring goes in layout; actions use return).
 */
export async function requireUser(): Promise<AuthResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      return { ok: false, code: "reauth_required" };
    }

    const user = data.user;

    // Check profile exists; create if missing (AC2)
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, status")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      // Profile missing — create via DB function (same as signup trigger)
      const serviceClient = createSupabaseServiceRoleClient();
      const created = await ensureProfile(
        serviceClient,
        user.id,
        user.email ?? "",
        (user.app_metadata as Record<string, unknown>) ?? {},
        (user.user_metadata as Record<string, unknown>) ?? {}
      );
      if (!created) return { ok: false, code: "unknown" };
    }

    return { ok: true, user: buildSessionUser(user) };
  } catch {
    return { ok: false, code: "unknown" };
  }
}

// ─── requireActiveAccount ────────────────────────────────────────────────────

/**
 * requireUser() + database check that the profile is not suspended (AC3).
 */
export async function requireActiveAccount(): Promise<AuthResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      return { ok: false, code: "reauth_required" };
    }

    const user = data.user;

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, status")
      .eq("id", user.id)
      .single();

    if (!profile) {
      // Create the profile then treat as active (trigger may have missed it)
      const serviceClient = createSupabaseServiceRoleClient();
      await ensureProfile(
        serviceClient,
        user.id,
        user.email ?? "",
        (user.app_metadata as Record<string, unknown>) ?? {},
        (user.user_metadata as Record<string, unknown>) ?? {}
      );
    } else if (profile.status === "suspended") {
      return { ok: false, code: "account_suspended" };
    }

    return { ok: true, user: buildSessionUser(user) };
  } catch {
    return { ok: false, code: "unknown" };
  }
}

// ─── Internal: load caller's staff role from DB ───────────────────────────────

async function getStaffRole(
  userId: string
): Promise<UserRole | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .single();
  return (data?.role as UserRole | undefined) ?? null;
}

// ─── requireStaff ────────────────────────────────────────────────────────────

/**
 * Full staff gate: requireActiveAccount + DB role + named permission +
 * TOTP enrolled + TOTP in session AMR + fresh sign-in window (AC4, AC5).
 * Deny by default. Super Admin passes all permissions.
 */
export async function requireStaff(
  permission: string
): Promise<AuthResult> {
  const accountResult = await requireActiveAccount();
  if (!accountResult.ok) return accountResult;

  const { user } = accountResult;

  // Staff window check (AC5)
  if (!isWithinStaffWindow(user.lastFullSignIn)) {
    return { ok: false, code: "reauth_required" };
  }

  // TOTP enrolled (AC5)
  if (!user.hasTotpEnrolled) {
    return { ok: false, code: "mfa_required" };
  }

  // Authenticator level in this session (AC5)
  if (!user.hasAuthenticatorLevel) {
    return { ok: false, code: "mfa_required" };
  }

  // DB role (EC1: database is truth, not token)
  const role = await getStaffRole(user.id);
  if (!role) {
    return { ok: false, code: "not_allowed" };
  }

  // Super Admin passes everything; others check via DB has_permission (AC4)
  if (role !== "super_admin") {
    const supabase = await createSupabaseServerClient();
    const { data: allowed } = await supabase.rpc("has_permission", {
      p_action: permission,
    });
    if (!allowed) {
      return { ok: false, code: "not_allowed" };
    }
  }

  return { ok: true, user: { ...user, claimedRole: role } };
}

// ─── requireSuperAdmin ────────────────────────────────────────────────────────

/**
 * requireStaff limited to the super_admin role (AC1).
 * Passes any permission check since Super Admin bypasses the table.
 */
export async function requireSuperAdmin(): Promise<AuthResult> {
  const accountResult = await requireActiveAccount();
  if (!accountResult.ok) return accountResult;

  const { user } = accountResult;

  if (!isWithinStaffWindow(user.lastFullSignIn)) {
    return { ok: false, code: "reauth_required" };
  }
  if (!user.hasTotpEnrolled) {
    return { ok: false, code: "mfa_required" };
  }
  if (!user.hasAuthenticatorLevel) {
    return { ok: false, code: "mfa_required" };
  }

  const role = await getStaffRole(user.id);
  if (role !== "super_admin") {
    const { writeDenied } = await import("@/lib/audit");
    await writeDenied(user.id, "staff_action", "super_admin_required").catch(() => undefined);
    return { ok: false, code: "not_allowed" };
  }

  return { ok: true, user: { ...user, claimedRole: "super_admin" } };
}

// ─── requireStaffNoMfa (AC6) ──────────────────────────────────────────────────

/**
 * Lower-level variant for /admin/security and /admin/mfa.
 * Requires a staff role but NOT the authenticator level or TOTP in AMR.
 * Still checks the staff window (reauth_required if stale).
 */
export async function requireStaffNoMfa(): Promise<AuthResult> {
  const accountResult = await requireActiveAccount();
  if (!accountResult.ok) return accountResult;

  const { user } = accountResult;

  if (!isWithinStaffWindow(user.lastFullSignIn)) {
    return { ok: false, code: "reauth_required" };
  }

  const role = await getStaffRole(user.id);
  if (!role) {
    return { ok: false, code: "not_allowed" };
  }

  return { ok: true, user: { ...user, claimedRole: role } };
}

// ─── assertNotSuperAdminTarget (AC7) ─────────────────────────────────────────

/**
 * Refuse any action whose target is a Super Admin when the caller is not a Super Admin.
 * Safe to call standalone — enforces the full staff gate (active account, 12-hour window,
 * TOTP enrolled, authenticator level, DB role) before the target check.
 * Call this alongside requireStaff(specificPermission), not instead of it.
 */
export async function assertNotSuperAdminTarget(
  targetUserId: string
): Promise<AuthResult> {
  const accountResult = await requireActiveAccount();
  if (!accountResult.ok) return accountResult;

  const { user } = accountResult;

  // Full staff gate — same checks as requireStaff minus the permission lookup.
  if (!isWithinStaffWindow(user.lastFullSignIn)) {
    return { ok: false, code: "reauth_required" };
  }
  if (!user.hasTotpEnrolled) {
    return { ok: false, code: "mfa_required" };
  }
  if (!user.hasAuthenticatorLevel) {
    return { ok: false, code: "mfa_required" };
  }

  const supabase = await createSupabaseServerClient();

  // Caller's role from DB
  const { data: callerRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  const callerRole = callerRow?.role as UserRole | undefined;

  if (!callerRole) {
    return { ok: false, code: "not_allowed" };
  }

  // Target's role — use profile_is_super_admin DB function (S-012)
  const { data: targetIsSA } = await supabase.rpc("profile_is_super_admin", {
    p_profile_id: targetUserId,
  });

  if (targetIsSA && callerRole !== "super_admin") {
    return { ok: false, code: "not_allowed" };
  }

  return { ok: true, user: accountResult.user };
}
