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
 * Returns mfa_required if the user already has a verified TOTP factor.
 */
export async function startMFAEnrolment(): Promise<StartMFAEnrolmentResult> {
  const auth = await requireStaffNoMfa();
  if (!auth.ok) return auth;

  if (auth.user.hasTotpEnrolled) {
    return { ok: false, code: "mfa_required" };
  }

  const supabase = await createSupabaseServerClient();
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
    return { ok: false, code: "code_invalid" };
  }

  return { ok: true };
}
