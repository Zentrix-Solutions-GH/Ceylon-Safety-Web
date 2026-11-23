import "server-only";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/server";
import { validateGroup } from "@/lib/settings/validation";
import { writeSettingsAuditRow } from "@/lib/settings/audit";
import { checkBankOrderPending, enforceStepUpForBank } from "@/lib/settings/bank";
import type { SettingGroup, SaveSettingsResult, SaveSettingsGroupParams } from "@/types/setting";

// Map each group to the permission action requireStaff must check (AC2).
const GROUP_PERMISSION: Record<SettingGroup, string> = {
  site:      "settings.site",      // Admin+
  contact:   "settings.contact",   // Super Admin only
  business:  "settings.business",  // Super Admin only
  analytics: "settings.analytics", // Super Admin only
};

export async function saveSettingsGroup(
  params: SaveSettingsGroupParams
): Promise<SaveSettingsResult> {
  const { group, values, updatedAt, code } = params;

  // 1. Permission check (AC2, EC1).
  const permission = GROUP_PERMISSION[group];
  if (!permission) return { ok: false, code: "not_allowed" };

  const authResult = await requireStaff(permission);
  if (!authResult.ok) return authResult as SaveSettingsResult;
  const actorId = authResult.user.id;

  // 2. Validate values (AC3). Use Zod-parsed output — strips unknown keys so a
  //    caller cannot inject keys from a higher-permission group (security: cross-group
  //    key injection defence).
  const validation = validateGroup(group, values);
  if (!validation.ok) {
    return { ok: false, code: "validation_failed", field: validation.field };
  }
  const sanitizedValues = validation.parsed;

  // 3. Step-up for bank details (AC5). Only required when bank_account_details
  //    is in the payload — other business-group fields (business_legal_name,
  //    owner_alert_email) do not need re-authentication.
  if (group === "business" && "bank_account_details" in sanitizedValues) {
    try {
      await enforceStepUpForBank(actorId, code);
    } catch (err) {
      const e = err as { code?: string };
      if (e.code === "mfa_required") return { ok: false, code: "mfa_required" };
      throw err;
    }

    // EC3: refuse to clear bank_account_details while a bank order is pending.
    if (sanitizedValues.bank_account_details === null) {
      const pending = await checkBankOrderPending();
      if (pending) {
        return { ok: false, code: "validation_failed", reason: "bank_order_pending" };
      }
    }
  }

  // 4. Fetch current rows for version check and audit (AC4, AC6).
  const keys = Object.keys(sanitizedValues);

  if (keys.length === 0) return { ok: true };

  const supabase = createSupabaseServiceRoleClient();

  const { data: currentRows, error: fetchError } = await supabase
    .from("site_settings")
    .select("key, value, updated_at")
    .eq("setting_group", group)
    .in("key", keys);

  if (fetchError) throw fetchError;

  // 5. Version conflict check (AC4).
  // Find the most recent updated_at among the rows we're about to touch.
  if (currentRows && currentRows.length > 0) {
    const latestUpdatedAt = currentRows.reduce<string | null>((max, row) => {
      const ts = row.updated_at as string | null;
      if (!ts) return max;
      return max === null || ts > max ? ts : max;
    }, null);

    // Guard: a non-ISO updatedAt string produces NaN from new Date(), which
    // makes the < comparison always false — treat it as a conflict to prevent
    // the bypass.
    const updatedAtMs = updatedAt === null ? NaN : new Date(updatedAt).getTime();

    // If caller sent null/invalid updatedAt and rows exist → conflict.
    // If caller's timestamp is older than the latest row → conflict.
    if (
      Number.isNaN(updatedAtMs) ||
      (latestUpdatedAt !== null &&
        updatedAtMs < new Date(latestUpdatedAt).getTime())
    ) {
      return { ok: false, code: "version_conflict" };
    }
  }

  // 6. Build old values map for audit.
  const oldValues: Record<string, unknown> = {};
  for (const row of currentRows ?? []) {
    oldValues[row.key as string] = row.value;
  }

  // 7. Upsert all changed keys in one call (single DB round-trip, atomic on
  //    partial failure). Uses sanitizedValues (Zod-parsed) — unknown keys stripped.
  //    Service role bypasses RLS; trigger enforces permission per group.
  //    setting_group is included so INSERT works on first-time keys. For existing
  //    rows the ON CONFLICT UPDATE sets it to the same stored value
  //    (NEW IS DISTINCT FROM OLD = false → trigger's reclassification guard does
  //    not fire). Cross-group key injection is prevented by Zod schema stripping
  //    above: sanitizedValues only contains keys belonging to `group`.
  const rows = Object.entries(sanitizedValues).map(([key, value]) => ({
    key,
    value: value as never,
    setting_group: group,
    updated_by: actorId,
  }));

  // NOTE: version check (step 5) and this upsert are two separate DB calls, so
  // two concurrent saves with identical updatedAt can both pass the guard and
  // both succeed (the second silently overwrites the first). A DB-level
  // conditional UPDATE (WHERE updated_at = $expected) would close this window
  // but requires an RPC migration. Acceptable for Release 1 (low-frequency
  // admin-only saves). Owner is aware — documented in S-099 review notes.
  const { error: upsertError } = await supabase
    .from("site_settings")
    .upsert(rows, { onConflict: "key" });

  if (upsertError) throw upsertError;

  // 8. Write audit row (AC6). Runs after the upsert — a transient audit error
  //    leaves the settings committed without a trail. The error is logged
  //    explicitly so the inconsistency surfaces in monitoring, then re-thrown
  //    so the caller sees a failure.
  try {
    await writeSettingsAuditRow(group, oldValues, sanitizedValues, actorId);
  } catch (auditErr) {
    console.error("[settings/save] audit write failed after upsert — settings saved, audit trail missing", { group, actorId, error: auditErr });
    throw auditErr;
  }

  return { ok: true };
}
