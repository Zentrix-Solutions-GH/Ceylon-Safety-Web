'use server';

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requestPasswordResetSchema } from "@/lib/validation/auth";
import { checkRateLimit } from "@/lib/ratelimit";
import { resetAttempts } from "@/lib/auth/attempt-counter";
import { headers } from "next/headers";
import type { RequestPasswordResetInput, RequestPasswordResetResult } from "@/types/auth";

export async function requestPasswordReset(
  input: RequestPasswordResetInput
): Promise<RequestPasswordResetResult> {
  const parsed = requestPasswordResetSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "validation_failed" };
  }
  const { email, captchaToken } = parsed.data;

  const reqHeaders = await headers();
  // Use only the Cloudflare-controlled header; x-real-ip is client-settable and must not be trusted.
  const ip = reqHeaders.get("cf-connecting-ip") ?? "unknown";

  // AC1: 3 per hour per email
  const emailLimit = await checkRateLimit({
    limitName: "reset-email",
    key: email,
    maxCount: 3,
    windowSeconds: 3600,
    mode: "closed",
  });
  if (!emailLimit.ok) {
    return { ok: false, code: "rate_limited" };
  }

  // AC1: 10 per hour per IP
  const ipLimit = await checkRateLimit({
    limitName: "reset-ip",
    key: ip,
    maxCount: 10,
    windowSeconds: 3600,
    mode: "closed",
  });
  if (!ipLimit.ok) {
    return { ok: false, code: "rate_limited" };
  }

  const supabase = await createSupabaseServerClient();
  // AC1/EC2: always call Supabase so timing is consistent; ignore any error (no account enumeration).
  await supabase.auth.resetPasswordForEmail(email, {
    captchaToken,
  });

  // P1 fix: reset the attempt counter so a fresh code starts from 0 (not left-over from last attempt).
  await resetAttempts(email, "reset");

  return { ok: true };
}
