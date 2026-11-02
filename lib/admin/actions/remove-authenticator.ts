"use server";
import "server-only";

import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth/server";
import { requireStepUp } from "@/lib/auth/step-up";
import { writeAuditRow } from "@/lib/audit/index";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { RemoveAuthenticatorResult } from "@/types/auth";

const RemoveAuthenticatorSchema = z.object({
  userId: z.string().uuid(),
  reason: z.string().min(1).max(500),
  totpCode: z.string().min(6).max(8),
});

/**
 * Remove all TOTP authenticators from an Admin or Editor account (lockout recovery).
 * Super Admin only. Refused for Super Admin targets (AC5).
 */
export async function removeAuthenticator(input: {
  userId: string;
  reason: string;
  totpCode: string;
}): Promise<RemoveAuthenticatorResult> {
  const parsed = RemoveAuthenticatorSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "validation_failed" };
  }
  const { userId, reason, totpCode } = parsed.data;

  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth;

  await requireStepUp(auth.user.id, totpCode);

  const serviceClient = createSupabaseServiceRoleClient();

  // Fetch target's role — refuse if not found or if Super Admin
  const { data: existing, error: fetchErr } = await serviceClient
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .single();

  if (fetchErr || !existing) {
    return { ok: false, code: "not_found" };
  }

  // AC5: refuse for Super Admin target
  if (existing.role === "super_admin") {
    return { ok: false, code: "not_allowed" };
  }

  // List and delete each verified TOTP factor individually
  const { data: { user: targetUser }, error: userErr } = await serviceClient.auth.admin.getUserById(userId);

  if (userErr || !targetUser) {
    return { ok: false, code: "not_found" };
  }

  const totpFactors = (targetUser.factors ?? []).filter(
    (f) => f.factor_type === "totp"
  );

  for (const factor of totpFactors) {
    const { error: deleteErr } = await serviceClient.auth.admin.mfa.deleteFactor({
      userId,
      id: factor.id,
    });
    if (deleteErr) {
      return { ok: false, code: "unknown" };
    }
  }

  await writeAuditRow({
    actorId: auth.user.id,
    action: "user.remove_mfa",
    entityType: "user",
    entityId: userId,
    after: { reason } as Record<string, unknown>,
  });

  return { ok: true };
}
