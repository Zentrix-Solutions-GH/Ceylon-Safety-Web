'use server';

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signInSchema } from "@/lib/validation/auth";
import { checkRateLimit } from "@/lib/ratelimit";
import { setPendingSignup } from "@/lib/auth/cookies";

import { safeNext } from "@/lib/auth/redirect";
import { headers } from "next/headers";
import type { SignInInput, SignInResult } from "@/types/auth";

export async function signIn(input: SignInInput): Promise<SignInResult> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "invalid_credentials" };
  }
  const { email, password, captchaToken, next } = parsed.data;

  // In server actions the raw socket address is unavailable; read trusted
  // Cloudflare header directly (all production traffic passes through CF).
  const reqHeaders = await headers();
  const ip =
    reqHeaders.get("cf-connecting-ip") ??
    reqHeaders.get("x-real-ip") ??
    "unknown";

  // Composite email+IP key: 5 / 15 min, closed (auth design §15)
  const compositeKey = `${email.trim().toLowerCase()}:${ip}`;
  const tier1 = await checkRateLimit({
    limitName: "signin-composite",
    key: compositeKey,
    maxCount: 5,
    windowSeconds: 900,
    mode: "closed",
  });
  if (!tier1.ok) {
    return {
      ok: false,
      code: "rate_limited",
      retryAfterSeconds: tier1.reason === "rate_limited" ? tier1.retryAfterSeconds : undefined,
    };
  }

  // Per-IP: 20 / hr, closed (auth design §15)
  const tier2 = await checkRateLimit({
    limitName: "signin-ip",
    key: ip,
    maxCount: 20,
    windowSeconds: 3600,
    mode: "closed",
  });
  if (!tier2.ok) {
    return {
      ok: false,
      code: "rate_limited",
      retryAfterSeconds: tier2.reason === "rate_limited" ? tier2.retryAfterSeconds : undefined,
    };
  }

  // Per-email: 30 / hr, open — triggers captcha challenge, not a hard block (auth design §15)
  const tier3 = await checkRateLimit({
    limitName: "signin-email",
    key: email.trim().toLowerCase(),
    maxCount: 30,
    windowSeconds: 3600,
    mode: "open",
  });
  if (!tier3.ok) {
    return { ok: false, code: "captcha_failed" };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
    options: { captchaToken },
  });

  if (error) {
    const msg = error.message.toLowerCase();

    if (msg.includes("banned") || msg.includes("suspended")) {
      return { ok: false, code: "account_suspended" };
    }

    if (msg.includes("email not confirmed")) {
      // Store pending email so the verify-email page has it (auth design §5.1 step 4).
      // Return invalid_credentials (not email_not_verified) to prevent account enumeration:
      // Supabase only reaches this error after verifying the password is correct, so
      // returning email_not_verified would confirm both the email and the password.
      await setPendingSignup({ email, next });
      return { ok: false, code: "invalid_credentials" };
    }

    // "Invalid login credentials" and any other Supabase error → same generic code
    return { ok: false, code: "invalid_credentials" };
  }

  if (!data.session) {
    return { ok: false, code: "invalid_credentials" };
  }

  return { ok: true, redirectTo: safeNext(next) };
}
