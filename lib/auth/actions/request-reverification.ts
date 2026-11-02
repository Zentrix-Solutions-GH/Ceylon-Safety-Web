'use server';

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requestReverificationSchema } from "@/lib/validation/auth";
import { checkRateLimit } from "@/lib/ratelimit";
import { resetAttempts } from "@/lib/auth/attempt-counter";
import type { RequestReverificationInput, RequestReverificationResult } from "@/types/auth";

export async function requestReverification(
  input: RequestReverificationInput
): Promise<RequestReverificationResult> {
  const parsed = requestReverificationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "validation_failed" };
  }
  const { captchaToken } = parsed.data;

  const supabase = await createSupabaseServerClient();

  // Require an authenticated session
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) {
    return { ok: false, code: "not_allowed" };
  }

  // P1: reject suspended accounts within their live JWT window
  const bannedUntil = (userData.user as { banned_until?: string }).banned_until;
  if (bannedUntil && new Date(bannedUntil) > new Date()) {
    return { ok: false, code: "not_allowed" };
  }

  // AC6: 3 requests per hour per signed-in user
  const limit = await checkRateLimit({
    limitName: "reverification-request",
    key: userData.user.id,
    maxCount: 3,
    windowSeconds: 3600,
    mode: "closed",
  });
  if (!limit.ok) {
    return { ok: false, code: "rate_limited" };
  }

  // AC6: uses the "magic link" template with shouldCreateUser: false (auth design §3, §12)
  const { error } = await supabase.auth.signInWithOtp({
    email: userData.user.email!,
    options: {
      shouldCreateUser: false,
      captchaToken,
    },
  });

  if (error) {
    return { ok: false, code: "unknown" };
  }

  // P1 fix: reset the attempt counter so a fresh code starts from 0.
  await resetAttempts(userData.user.email!, "reverify");

  return { ok: true };
}
