'use server';

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { verifyEmailSchema } from "@/lib/validation/auth";
import { getAttempts, incAttempts, resetAttempts } from "@/lib/auth/attempt-counter";
import { getPendingSignup, clearPendingSignup } from "@/lib/auth/cookies";
import { safeNext } from "@/lib/auth/redirect";
import type { VerifyEmailInput, VerifyEmailResult } from "@/types/auth";

const MAX_ATTEMPTS = 5;

// Supabase returns this exact phrase for a truly expired OTP (vs "Token has expired or is invalid"
// for a wrong code). Extract so it is easy to update after a Supabase Auth upgrade.
const SUPABASE_OTP_EXPIRED_MSG = "invalid or has expired";

export async function verifyEmail(input: VerifyEmailInput): Promise<VerifyEmailResult> {
  // 1. Validate input
  const parsed = verifyEmailSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "validation_failed" };
  }

  const { email, code } = parsed.data;

  // 2. Check wrong-attempt counter (AC4)
  const attempts = await getAttempts(email);
  if (attempts >= MAX_ATTEMPTS) {
    return { ok: false, code: "code_attempts_exceeded" };
  }

  // 3. Retrieve saved next page from cookie (EC1: cookie may be absent — use "/" as default)
  const pending = await getPendingSignup();
  const nextPage = safeNext(pending?.next);

  // 4. Verify the OTP with Supabase
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });

  if (error) {
    const msg = error.message.toLowerCase();
    // Supabase returns "Email link is invalid or has expired" for a truly expired OTP,
    // vs "Token has expired or is invalid" for a wrong code. The phrase order differs.
    if (msg.includes(SUPABASE_OTP_EXPIRED_MSG)) {
      return { ok: false, code: "code_expired" };
    }

    // Wrong code — increment attempt counter; use Redis INCR return value (not stale local read)
    const newAttempts = await incAttempts(email);
    if (newAttempts >= MAX_ATTEMPTS) {
      return { ok: false, code: "code_attempts_exceeded" };
    }
    return { ok: false, code: "code_invalid" };
  }

  // 5. Success — reset counter and clear cookie
  await resetAttempts(email);
  await clearPendingSignup();

  return { ok: true, redirect: nextPage };
}
