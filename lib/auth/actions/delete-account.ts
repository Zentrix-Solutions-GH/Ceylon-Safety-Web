'use server';

import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireActiveAccount } from "@/lib/auth/server";
import { deleteAccountSchema } from "@/lib/validation/user";
import { confirmReverification } from "@/lib/auth/actions/confirm-reverification";
import type { DeleteAccountInput, DeleteAccountResult } from "@/types/user";
import type { UserRole } from "@/types/auth";

export async function deleteAccount(input: DeleteAccountInput): Promise<DeleteAccountResult> {
  const parsed = deleteAccountSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "validation_failed" };
  }
  const { code, authenticatorCode } = parsed.data;

  // AC8: require active (non-suspended) account via shared helper
  const authResult = await requireActiveAccount();
  if (!authResult.ok) {
    return { ok: false, code: "not_allowed" };
  }
  const userId = authResult.user.id;

  // AC4: staff accounts cannot self-delete
  // claimedRole from the JWT is sufficient here — staff role is set at auth time
  const claimedRole = authResult.user.claimedRole as UserRole | undefined;
  if (claimedRole) {
    return { ok: false, code: "not_allowed" };
  }

  // AC4: validate the re-verification code (magic-link OTP, possibly + TOTP)
  const verifyResult = await confirmReverification({ code, authenticatorCode });
  if (!verifyResult.ok) {
    return verifyResult;
  }

  const supabase = await createSupabaseServerClient();

  // AC5: check for blocking conditions
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  // Block if: pending card order, pending_verification bank order, or any order in last 2 hours
  const { data: blockingOrder } = await supabase
    .from("orders")
    .select("id")
    .eq("user_id", userId)
    .or(`status.eq.pending,status.eq.pending_verification,created_at.gte.${twoHoursAgo}`)
    .limit(1)
    .maybeSingle();

  if (blockingOrder) {
    return { ok: false, code: "validation_failed" };
  }

  // Block if: open download request
  const { data: blockingDownload } = await supabase
    .from("download_requests")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "open")
    .limit(1)
    .maybeSingle();

  if (blockingDownload) {
    return { ok: false, code: "validation_failed" };
  }

  // AC6: anonymise the user (clears PII, removes cart, cancels pending card orders).
  // Idempotent — second call is a no-op. Does NOT remove auth.users (we do that below).
  // private.anonymise_user is in the private schema (SECURITY DEFINER, not in typed RPC list)
  // so we use the service role client and cast the rpc name.
  const serviceClient = createSupabaseServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: anonymiseError } = await (serviceClient as any).rpc("private.anonymise_user", {
    p_user_id: userId,
  });

  if (anonymiseError) {
    return { ok: false, code: "unknown" };
  }

  // AC6: remove the login via the admin API (after anonymise, so PII is gone even on partial failure).
  // EC4: if this fails, profile is already anonymised — user cannot sign in with real data.
  const { error: deleteAuthError } = await serviceClient.auth.admin.deleteUser(userId);
  if (deleteAuthError) {
    return { ok: false, code: "unknown" };
  }

  // AC6: sign out all sessions (best-effort — user is already deleted from auth)
  await supabase.auth.signOut({ scope: "global" });

  return { ok: true };
}
