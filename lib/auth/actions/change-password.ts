'use server';

// AC5: changePassword uses the Supabase reauthentication code (verify item 22).
// The frontend calls supabase.auth.reauthenticate() which sends the code via the
// "reauthentication" email template. This server action receives the code + new
// password and calls updateUser with the nonce.
// Google-only check: user has no "email" identity, not "signed in with Google this session",
// so a user who added a password after Google sign-in is correctly allowed.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { changePasswordSchema } from "@/lib/validation/auth";
import { getAttempts, incAttempts, resetAttempts } from "@/lib/auth/attempt-counter";
import type { ChangePasswordInput, ChangePasswordResult } from "@/types/auth";

const MAX_ATTEMPTS = 5;

export async function changePassword(input: ChangePasswordInput): Promise<ChangePasswordResult> {
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "validation_failed" };
  }
  const { code, newPassword } = parsed.data;

  const supabase = await createSupabaseServerClient();

  // Require an authenticated session
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) {
    return { ok: false, code: "not_allowed" };
  }

  // AC5: Google-only accounts get not_allowed — they use "Forgot password" to add a password.
  // Detection: user has no identity with provider "email".
  const hasPasswordIdentity = (userData.user.identities ?? []).some(
    (i) => i.provider === "email"
  );
  if (!hasPasswordIdentity) {
    return { ok: false, code: "not_allowed" };
  }

  // P0 fix: attempt counter keyed on user ID to prevent nonce brute-force (changepw namespace)
  const attempts = await getAttempts(userData.user.id, "changepw");
  if (attempts >= MAX_ATTEMPTS) {
    return { ok: false, code: "code_attempts_exceeded" };
  }

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
    nonce: code,
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("password") && (msg.includes("weak") || msg.includes("8 character"))) {
      return { ok: false, code: "weak_password" };
    }
    if (msg.includes("expired") || msg.includes("invalid") || msg.includes("nonce")) {
      await incAttempts(userData.user.id, "changepw");
      return { ok: false, code: "code_invalid" };
    }
    return { ok: false, code: "unknown" };
  }

  await resetAttempts(userData.user.id, "changepw");
  return { ok: true };
}
