'use server';

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signUpSchema } from "@/lib/validation/auth";
import { checkRateLimit } from "@/lib/ratelimit";
import { getClientIp } from "@/lib/ratelimit/client-ip";
import { setPendingSignup } from "@/lib/auth/cookies";
import { headers } from "next/headers";
import type { SignUpInput, SignUpResult } from "@/types/auth";

const MAX_PASSWORD_LENGTH = 128;
const HIBP_PREFIX_LENGTH = 5;

async function checkBreachedPassword(password: string): Promise<boolean> {
  // Only the first 5 hex characters of the SHA-1 hash are sent (k-anonymity model).
  // Returns true if the password appears in the breach database.
  try {
    const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(password));
    const hex = Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
    const prefix = hex.slice(0, HIBP_PREFIX_LENGTH);
    const suffix = hex.slice(HIBP_PREFIX_LENGTH);

    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return false; // fail open on any HTTP error

    const text = await res.text();
    return text.split("\n").some((line) => line.startsWith(suffix));
  } catch {
    return false; // fail open — unreachable service does not block sign-up (AC8)
  }
}

export async function signUp(input: SignUpInput): Promise<SignUpResult> {
  // 1. Validate input
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    const field = firstError?.path[0] as string | undefined;
    // Map terms and password field errors to specific codes
    if (field === "termsAccepted") {
      return { ok: false, code: "validation_failed", field: "terms" };
    }
    if (field === "password") {
      return { ok: false, code: "validation_failed", field: "password" };
    }
    return { ok: false, code: "validation_failed", field };
  }

  const { firstName, lastName, email, password, captchaToken, next } = parsed.data;

  // 2. Reject passwords that are too long (defence in depth; Supabase also checks)
  if (password.length > MAX_PASSWORD_LENGTH) {
    return { ok: false, code: "validation_failed", field: "password" };
  }

  // 3. Breached-password check (AC8, M36)
  const isBreached = await checkBreachedPassword(password);
  if (isBreached) {
    return { ok: false, code: "weak_password", field: "password" };
  }

  // 4. Rate limit: 5 / hour / IP, open mode (auth design §15)
  const reqHeaders = await headers();
  const ip = getClientIp(reqHeaders, undefined) ?? "unknown";
  const rl = await checkRateLimit({
    limitName: "signup",
    key: ip,
    maxCount: 5,
    windowSeconds: 3600,
    mode: "open",
  });
  if (!rl.ok && rl.reason === "rate_limited") {
    return { ok: false, code: "rate_limited", field: undefined };
  }

  // 5. Call Supabase — neutral result for both new and existing emails (AC3)
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { first_name: firstName, last_name: lastName },
      captchaToken,
    },
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("captcha")) {
      return { ok: false, code: "captcha_failed" };
    }
    if (msg.includes("password") && (msg.includes("weak") || msg.includes("length"))) {
      return { ok: false, code: "weak_password", field: "password" };
    }
    // AC3: existing email ("User already registered" 422) and any other Supabase error
    // both return success — never reveal whether the email is registered.
    // Intentional: do NOT add a return here; fall through to setPendingSignup.
  }

  // 6. Store pending email in cookie (AC2)
  await setPendingSignup({ email, next });

  return { ok: true, redirect: "/verify-email" };
}
