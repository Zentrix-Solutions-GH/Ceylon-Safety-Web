'use server';

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { confirmReverificationSchema } from "@/lib/validation/auth";
import { getAttempts, incAttempts, resetAttempts } from "@/lib/auth/attempt-counter";
import type { ConfirmReverificationInput, ConfirmReverificationResult } from "@/types/auth";

const MAX_ATTEMPTS = 5;

export async function confirmReverification(
  input: ConfirmReverificationInput
): Promise<ConfirmReverificationResult> {
  const parsed = confirmReverificationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "validation_failed" };
  }
  const { code, authenticatorCode } = parsed.data;

  const supabase = await createSupabaseServerClient();

  // Require an authenticated session
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) {
    return { ok: false, code: "not_allowed" };
  }

  const email = userData.user.email!;

  // AC7: attempt counter keyed on email, "reverify" namespace (avoids collision with "reset" bucket)
  const attempts = await getAttempts(email, "reverify");
  if (attempts >= MAX_ATTEMPTS) {
    return { ok: false, code: "code_attempts_exceeded" };
  }

  // Verify the magic-link OTP code (type: "magiclink" per auth design §3 + §12)
  const { data: otpData, error: otpError } = await supabase.auth.verifyOtp({
    email,
    token: code,
    type: "magiclink",
  });

  if (otpError || !otpData?.user) {
    await incAttempts(email, "reverify");
    const msg = otpError?.message?.toLowerCase() ?? "";
    if (msg.includes("expired") && !msg.includes("invalid")) {
      return { ok: false, code: "code_expired" };
    }
    return { ok: false, code: "code_invalid" };
  }

  // AC6: for accounts with a verified TOTP factor, also require the authenticator code
  const { data: factorsData } = await supabase.auth.mfa.listFactors();
  const verifiedFactor = (factorsData?.totp ?? []).find((f) => f.status === "verified");

  if (verifiedFactor) {
    if (!authenticatorCode) {
      return { ok: false, code: "mfa_required" };
    }
    const { error: mfaError } = await supabase.auth.mfa.challengeAndVerify({
      factorId: verifiedFactor.id,
      code: authenticatorCode,
    });
    if (mfaError) {
      // P1 fix: count wrong TOTP attempts against the same "reverify" bucket
      await incAttempts(email, "reverify");
      return { ok: false, code: "code_invalid" };
    }
  }

  await resetAttempts(email, "reverify");
  return { ok: true };
}
