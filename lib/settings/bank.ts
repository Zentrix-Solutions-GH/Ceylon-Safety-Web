import "server-only";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireStepUp } from "@/lib/auth/step-up";

/**
 * Returns true when at least one order is in pending_verification status
 * (i.e. a bank transfer awaiting approval). Used by EC3: bank details cannot
 * be cleared while a pending bank order exists.
 */
export async function checkBankOrderPending(): Promise<boolean> {
  const supabase = createSupabaseServiceRoleClient();
  const { count, error } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .in("status", ["pending_verification"]);

  if (error) throw error; // fail closed: surface DB errors rather than silently permitting the clear
  return (count ?? 0) > 0;
}

/**
 * Enforces a fresh TOTP step-up before saving bank details (AC5).
 * Delegates to the S-038 helper which caches a successful code for 300 s.
 * Throws { code: "mfa_required" } when the code is absent, wrong or expired.
 */
export async function enforceStepUpForBank(
  actorId: string,
  totpCode: string | undefined
): Promise<void> {
  await requireStepUp(actorId, totpCode);
}
