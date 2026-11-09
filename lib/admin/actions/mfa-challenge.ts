"use server";
import "server-only";

import { z } from "zod";
import { requireStaffNoMfa } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MFAChallengeResult } from "@/types/auth";

const ChallengeSchema = z.object({
  code: z.string().length(6).regex(/^\d{6}$/),
});

/**
 * Verify a TOTP code for an already-enrolled staff member.
 * On success the session is elevated to aal2 (authenticator level).
 */
export async function submitMFAChallenge(input: {
  code: string;
}): Promise<MFAChallengeResult> {
  const parsed = ChallengeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "validation_failed" };
  const { code } = parsed.data;

  const auth = await requireStaffNoMfa();
  if (!auth.ok) return auth;

  const supabase = await createSupabaseServerClient();

  const { data: factors, error: listErr } =
    await supabase.auth.mfa.listFactors();

  if (listErr) {
    return { ok: false, code: "unknown" };
  }

  const totpFactor = factors?.totp?.find((f) => f.status === "verified");
  if (!totpFactor) {
    return { ok: false, code: "mfa_required" };
  }

  const { data: challengeData, error: challengeErr } =
    await supabase.auth.mfa.challenge({ factorId: totpFactor.id });

  if (challengeErr || !challengeData) {
    return { ok: false, code: "unknown" };
  }

  const { error: verifyErr } = await supabase.auth.mfa.verify({
    factorId: totpFactor.id,
    challengeId: challengeData.id,
    code,
  });

  if (verifyErr) {
    // AC3: Supabase returns 429 / mfa_totp_challenge_expired for too-many-attempts
    const status = (verifyErr as { status?: number }).status;
    if (status === 429) {
      return { ok: false, code: "code_attempts_exceeded" };
    }
    return { ok: false, code: "code_invalid" };
  }

  return { ok: true };
}
