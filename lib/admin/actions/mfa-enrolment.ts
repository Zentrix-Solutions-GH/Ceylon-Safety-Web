"use server";
import "server-only";

import { z } from "zod";
import { requireStaffNoMfa } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  StartMFAEnrolmentResult,
  MFAEnrolmentResult,
} from "@/types/auth";

const ConfirmSchema = z.object({
  factorId: z.string().min(1),
  code: z.string().length(6).regex(/^\d{6}$/),
});

/**
 * Start TOTP enrolment for the signed-in staff member.
 * Returns the TOTP URI (for QR code) and secret (for manual entry).
 * Returns already_enrolled if the user already has a verified TOTP factor.
 * Cleans up stale pending factors before enrolling to prevent accumulation.
 */
export async function startMFAEnrolment(): Promise<StartMFAEnrolmentResult> {
  const auth = await requireStaffNoMfa();
  if (!auth.ok) return auth;

  if (auth.user.hasTotpEnrolled) {
    return { ok: false, code: "already_enrolled" };
  }

  const supabase = await createSupabaseServerClient();

  // Remove any stale unverified TOTP factors to prevent pending-factor accumulation.
  // factors.totp only contains verified factors; unverified ones are in factors.all.
  const { data: existing } = await supabase.auth.mfa.listFactors();
  if (existing?.all) {
    for (const factor of existing.all) {
      if (factor.factor_type === "totp" && factor.status === "unverified") {
        await supabase.auth.mfa.unenroll({ factorId: factor.id });
      }
    }
  }

  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });

  if (error || !data?.totp) {
    return { ok: false, code: "unknown" };
  }

  return {
    ok: true,
    factorId: data.id,
    uri: data.totp.uri,
    secret: data.totp.secret,
  };
}

/**
 * Confirm TOTP enrolment by verifying the first code from the authenticator app.
 * On success the session is elevated to aal2 (authenticator level).
 */
export async function confirmMFAEnrolment(input: {
  factorId: string;
  code: string;
}): Promise<MFAEnrolmentResult> {
  const parsed = ConfirmSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "validation_failed" };
  const { factorId, code } = parsed.data;

  const auth = await requireStaffNoMfa();
  if (!auth.ok) return auth;

  const supabase = await createSupabaseServerClient();

  // Verify the factorId belongs to the calling user (defence-in-depth;
  // Supabase also enforces this, but an explicit check prevents factor confusion).
  // Unverified factors are in factors.all, not factors.totp (which only has verified ones).
  const { data: factors, error: listErr } = await supabase.auth.mfa.listFactors();
  if (listErr) return { ok: false, code: "unknown" };
  const ownedFactor = factors?.all?.find(
    (f) => f.id === factorId && f.factor_type === "totp" && f.status === "unverified"
  );
  if (!ownedFactor) return { ok: false, code: "not_found" };

  const { data: challengeData, error: challengeErr } =
    await supabase.auth.mfa.challenge({ factorId });

  if (challengeErr || !challengeData) {
    return { ok: false, code: "unknown" };
  }

  const { error: verifyErr } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challengeData.id,
    code,
  });

  if (verifyErr) {
    const status = (verifyErr as { status?: number }).status;
    if (status === 429) return { ok: false, code: "code_attempts_exceeded" };
    return { ok: false, code: "code_invalid" };
  }

  return { ok: true };
}
