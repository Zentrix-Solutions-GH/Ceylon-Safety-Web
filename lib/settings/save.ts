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

  // 3. Step-up for bank details (AC5).
  if (group === "business") {
    try {
      await enforceStepUpForBank(actorId, code);
    } catch (err) {
      const e = err as { code?: string };
      if (e.code === "mfa_required") return { ok: false, code: "mfa_required" };
      throw err;
    }

    // EC3: refuse to clear bank_account_details while a bank order is pending.
    if ("bank_account_details" in sanitizedValues && sanitizedValues.bank_account_details === null) {
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

    // If caller sent null updatedAt and rows exist → conflict (analyst-gap EC).
    // If caller's timestamp is older than the latest row → conflict.
    if (
      updatedAt === null ||
      (latestUpdatedAt !== null &&
        new Date(updatedAt) < new Date(latestUpdatedAt))
    ) {
      return { ok: false, code: "version_conflict" };
    }
  }

  // 6. Build old values map for audit.
  const oldValues: Record<string, unknown> = {};
  for (const row of currentRows ?? []) {
    oldValues[row.key as string] = row.value;
  }

  // 7. Upsert each changed key via service role (bypasses RLS; trigger enforces permission).
  //    Uses sanitizedValues (Zod-parsed) — unknown keys have been stripped.
  for (const [key, value] of Object.entries(sanitizedValues)) {
    const { error: updateError } = await supabase
      .from("site_settings")
      .update({ value: value as never, updated_by: actorId })
      .eq("key", key)
      .eq("setting_group", group);

    if (updateError) throw updateError;
  }

  // 8. Write audit row (AC6).
  await writeSettingsAuditRow(group, oldValues, sanitizedValues, actorId);

  return { ok: true };
}
