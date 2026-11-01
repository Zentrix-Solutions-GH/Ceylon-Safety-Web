import type { User } from "@supabase/supabase-js";
import type { SessionUser, UserRole, AccountStatus } from "@/types/auth";

const STAFF_WINDOW_HOURS = 12;

/**
 * Build a SessionUser from the Supabase-verified user object.
 * Reads AMR timestamps to determine the last full sign-in (EC4).
 * Falls back to last_sign_in_at when AMR is absent.
 */
export function buildSessionUser(user: User): SessionUser {
  const userAsAny = user as unknown as Record<string, unknown>;
  const claimedRole =
    (userAsAny["user_role"] as UserRole | undefined) ??
    ((user.app_metadata as Record<string, unknown> | undefined)?.["user_role"] as UserRole | undefined);

  const claimedStatus = userAsAny["account_status"] as AccountStatus | undefined;

  // AMR: authentication method references — array of { method, timestamp } from JWT.
  // EC4: use the most recent full-auth timestamp from AMR, fall back to last_sign_in_at.
  const amr = (user as { amr?: { method: string; timestamp: number }[] }).amr ?? [];

  // A "full sign-in" requires at least one of: password, magiclink, otp, oauth.
  // TOTP alone is not a full sign-in — it is the authenticator level step.
  const FULL_AUTH_METHODS = new Set(["password", "magiclink", "otp", "oauth"]);
  const fullAuthEntries = amr.filter((a) => FULL_AUTH_METHODS.has(a.method));

  let lastFullSignIn: string | undefined;
  if (fullAuthEntries.length > 0) {
    const maxTs = Math.max(...fullAuthEntries.map((a) => a.timestamp));
    lastFullSignIn = new Date(maxTs * 1000).toISOString();
  } else {
    // EC4 fallback: server-side last_sign_in_at
    lastFullSignIn = user.last_sign_in_at ?? undefined;
  }

  const hasAuthenticatorLevel = amr.some((a) => a.method === "totp");

  const factors = (user as { factors?: { factor_type: string; status: string }[] }).factors ?? [];
  const hasTotpEnrolled = factors.some(
    (f) => f.factor_type === "totp" && f.status === "verified"
  );

  return {
    id: user.id,
    email: user.email ?? "",
    claimedRole,
    claimedStatus,
    lastFullSignIn,
    hasAuthenticatorLevel,
    hasTotpEnrolled,
  };
}

export function isWithinStaffWindow(lastFullSignIn: string | undefined): boolean {
  if (!lastFullSignIn) return false;
  const elapsed = Date.now() - new Date(lastFullSignIn).getTime();
  return elapsed < STAFF_WINDOW_HOURS * 60 * 60 * 1000;
}

export { STAFF_WINDOW_HOURS };
