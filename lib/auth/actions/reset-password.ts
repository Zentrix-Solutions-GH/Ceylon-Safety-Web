'use server';

// AC4 note — Verify item 6: whether Supabase sends its own "password changed" security notice.
// If Supabase's own notice is enabled in Auth settings (Dashboard → Auth → Email → "Secure password change"),
// we must NOT send our own to avoid double-sending. Check Supabase dashboard before enabling the send below.
// TODO(verify-6): enable or disable the password-changed email once verify item 6 is resolved.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resetPasswordSchema } from "@/lib/validation/auth";
import { getAttempts, incAttempts, resetAttempts } from "@/lib/auth/attempt-counter";
import { setPendingReset, clearPendingReset } from "@/lib/auth/cookies";
import type { ResetPasswordInput, ResetPasswordResult } from "@/types/auth";

const MAX_ATTEMPTS = 5;

export async function resetPassword(input: ResetPasswordInput): Promise<ResetPasswordResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "validation_failed" };
  }
  const { email, code, newPassword, authenticatorCode } = parsed.data;

  // AC7: check attempt counter before calling Supabase (namespace "reset" avoids collision with reverify)
  const attempts = await getAttempts(email, "reset");
  if (attempts >= MAX_ATTEMPTS) {
    return { ok: false, code: "code_attempts_exceeded" };
  }

  const supabase = await createSupabaseServerClient();

  // Step 1: verify the emailed recovery code — starts a lower-level session
  const { data: otpData, error: otpError } = await supabase.auth.verifyOtp({
    email,
    token: code,
    type: "recovery",
  });

  if (otpError || !otpData?.user) {
    await incAttempts(email, "reset");
    const msg = otpError?.message?.toLowerCase() ?? "";
    // "Token has expired or is invalid" is Supabase's generic OTP failure message.
    // Only return code_expired when the message says purely "expired" (no "invalid").
    if (msg.includes("expired") && !msg.includes("invalid")) {
      return { ok: false, code: "code_expired" };
    }
    return { ok: false, code: "code_invalid" };
  }

  // AC2/EC1 (verify item 16): check if the account has a verified TOTP factor.
  // Finding: YES — the emailed code alone must not change a staff password. The TOTP step
  // is required whenever a verified factor exists, regardless of whether the caller is "staff".
  const { data: factorsData } = await supabase.auth.mfa.listFactors();
  const hasTotp = (factorsData?.totp ?? []).some((f) => f.status === "verified");

  if (hasTotp) {
    if (!authenticatorCode) {
      return { ok: false, code: "mfa_required" };
    }
    const verifiedFactor = (factorsData?.totp ?? []).find((f) => f.status === "verified");
    if (!verifiedFactor) {
      return { ok: false, code: "unknown" };
    }
    const { error: mfaError } = await supabase.auth.mfa.challengeAndVerify({
      factorId: verifiedFactor.id,
      code: authenticatorCode,
    });
    if (mfaError) {
      // P1 fix: count wrong TOTP attempts against the same "reset" bucket
      await incAttempts(email, "reset");
      return { ok: false, code: "code_invalid" };
    }
  }

  // Step 2: set the new password
  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
  if (updateError) {
    const msg = updateError.message.toLowerCase();
    if (msg.includes("password") && (msg.includes("weak") || msg.includes("8 character"))) {
      return { ok: false, code: "weak_password" };
    }
    await incAttempts(email, "reset");
    return { ok: false, code: "unknown" };
  }

  // AC2: sign out all other devices
  await supabase.auth.signOut({ scope: "others" });

  // AC3: clear the pending-reset cookie (if the frontend set it after the code check step)
  await clearPendingReset();

  // AC7: reset attempt counter on success
  await resetAttempts(email, "reset");

  return { ok: true, redirectTo: "/" };
}

// Helper exported for the two-step flow: call after verifying the code in step 1
// to set the pending-reset cookie so /reset-password knows the user is mid-reset.
export async function markResetPending(email: string): Promise<void> {
  await setPendingReset({ email });
}
