'use server';

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resendCodeSchema } from "@/lib/validation/auth";
import { checkRateLimit } from "@/lib/ratelimit";
import { resetAttempts } from "@/lib/auth/attempt-counter";
import type { ResendCodeInput, ResendCodeResult } from "@/types/auth";

export async function resendCode(input: ResendCodeInput): Promise<ResendCodeResult> {
  // 1. Validate input
  const parsed = resendCodeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "validation_failed" };
  }

  const { email, captchaToken } = parsed.data;

  // 2. Rate limit: 1 / 60 s / email (cooldown) — closed mode (auth design §15)
  const cooldownRl = await checkRateLimit({
    limitName: "resend_cooldown",
    key: email,
    maxCount: 1,
    windowSeconds: 60,
    mode: "closed",
  });
  if (!cooldownRl.ok && cooldownRl.reason === "rate_limited") {
    return {
      ok: false,
      code: "rate_limited",
      retryAfterSeconds: cooldownRl.retryAfterSeconds,
      reason: "cooldown",
    };
  }

  // 3. Rate limit: 5 / hour / email (hourly cap) — closed mode (auth design §15)
  const hourlyRl = await checkRateLimit({
    limitName: "resend_hourly",
    key: email,
    maxCount: 5,
    windowSeconds: 3600,
    mode: "closed",
  });
  if (!hourlyRl.ok && hourlyRl.reason === "rate_limited") {
    return {
      ok: false,
      code: "rate_limited",
      retryAfterSeconds: hourlyRl.retryAfterSeconds,
      reason: "hourly",
    };
  }

  // 4. Call Supabase resend — neutral result regardless of whether email exists (AC3 pattern)
  const supabase = await createSupabaseServerClient();
  await supabase.auth.resend({ type: "signup", email, options: { captchaToken } });

  // 5. Reset the wrong-attempt counter — new code invalidates previous tries (AC5)
  await resetAttempts(email);

  return { ok: true };
}
