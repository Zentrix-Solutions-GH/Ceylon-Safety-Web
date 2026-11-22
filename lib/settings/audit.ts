import "server-only";
import { writeAuditRow } from "@/lib/audit";
import type { SettingGroup } from "@/types/setting";
import type { AuditEventName } from "@/types/audit";

// Map group → audit event name (AC6).
// contact → settings.contact_change
// business → settings.business_change
// everything else → settings.change
function auditEventForGroup(group: SettingGroup): AuditEventName {
  if (group === "contact") return "settings.contact_change";
  if (group === "business") return "settings.business_change";
  return "settings.change";
}

// Mask digit runs of 8+ characters (bank account numbers).
// Mirrors the masking in lib/audit/index.ts but applied before we pass values in,
// so this layer controls what appears in settings-specific audit rows.
function maskValue(val: unknown): unknown {
  if (typeof val === "string") return val.replace(/\b\d{8,}\b/g, "***");
  if (Array.isArray(val)) return val.map(maskValue);
  if (val !== null && typeof val === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      out[k] = maskValue(v);
    }
    return out;
  }
  return val;
}

function maskRecord(values: Record<string, unknown>): Record<string, unknown> {
  return maskValue(values) as Record<string, unknown>;
}

export async function writeSettingsAuditRow(
  group: SettingGroup,
  oldValues: Record<string, unknown>,
  newValues: Record<string, unknown>,
  actorId: string
): Promise<void> {
  await writeAuditRow({
    action: auditEventForGroup(group),
    actorId,
    entityType: "site_settings",
    entityId: group,
    before: maskRecord(oldValues),
    after: maskRecord(newValues),
  });
}
