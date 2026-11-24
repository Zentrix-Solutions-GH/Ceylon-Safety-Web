import "server-only";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/resend/client";
import { isBudgetExceeded, isSecurityAlert } from "@/lib/alerts/email-budget";
import type { OwnerAlertEvent } from "@/types/audit";

export interface AlertDetail {
  auditRowId: string;
  actorName: string;
  actorId: string;
  actorIsSuperAdmin?: boolean;
  changedAt: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
}

// Mask runs of 8+ digits (bank account numbers etc.) — AC1, AC7.
function maskSensitive(value: string): string {
  return value.replace(/\d{8,}/g, "****");
}

function renderAlertHtml(event: OwnerAlertEvent, detail: AlertDetail): string {
  const actorLabel = detail.actorIsSuperAdmin ? "Support" : detail.actorName;
  const oldVal = detail.oldValue ? maskSensitive(detail.oldValue) : "(not set)";
  const newVal = detail.newValue ? maskSensitive(detail.newValue) : "(not set)";
  return `
<p><strong>Owner security alert</strong></p>
<p>Event: ${event}<br>
Changed by: ${actorLabel}<br>
At: ${detail.changedAt}</p>
${detail.field ? `<p>Field: ${detail.field}<br>Old: ${oldVal}<br>New: ${newVal}</p>` : ""}
<p>CeylonSafety admin system</p>
  `.trim();
}

function renderAlertText(event: OwnerAlertEvent, detail: AlertDetail): string {
  const actorLabel = detail.actorIsSuperAdmin ? "Support" : detail.actorName;
  const oldVal = detail.oldValue ? maskSensitive(detail.oldValue) : "(not set)";
  const newVal = detail.newValue ? maskSensitive(detail.newValue) : "(not set)";
  return [
    "Owner security alert",
    `Event: ${event}`,
    `Changed by: ${actorLabel}`,
    `At: ${detail.changedAt}`,
    ...(detail.field ? [`Field: ${detail.field}`, `Old: ${oldVal}`, `New: ${newVal}`] : []),
  ].join("\n");
}

// Read owner_alert_email and second_alert_email from site_settings.
async function readAlertAddresses(): Promise<{ owner: string | null; second: string | null }> {
  const db = createSupabaseServiceRoleClient();
  const { data } = await db
    .from("site_settings")
    .select("key, value")
    .in("key", ["owner_alert_email", "second_alert_email"]);
  const rows = (data ?? []) as Array<{ key: string; value: unknown }>;
  const get = (key: string) => {
    const row = rows.find((r) => r.key === key);
    return typeof row?.value === "string" && row.value ? row.value : null;
  };
  return { owner: get("owner_alert_email"), second: get("second_alert_email") };
}

// Hold an alert in owner_alert_held when budget is exceeded.
async function holdAlert(event: OwnerAlertEvent, detail: AlertDetail): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createSupabaseServiceRoleClient() as any;
  const { error } = await db.from("owner_alert_held").insert({
    event,
    detail: detail as unknown as Record<string, unknown>,
    audit_row_id: /^\d+$/.test(detail.auditRowId) ? Number(detail.auditRowId) : null,
  });
  if (error) {
    console.error("[owner-alert] holdAlert insert failed:", (error as { code?: string }).code ?? "unknown");
  }
}

// AC1, AC3, AC4, AC6, EC1, EC4.
export async function sendOwnerAlert(event: OwnerAlertEvent, detail: AlertDetail): Promise<void> {
  try {
    const { owner, second } = await readAlertAddresses();
    if (!owner) return;

    // AC4: hold non-security alerts when over budget.
    const security = isSecurityAlert(event);
    if (!security && (await isBudgetExceeded())) {
      await holdAlert(event, detail);
      return;
    }

    const html = renderAlertHtml(event, detail);
    const text = renderAlertText(event, detail);
    const subject = `[CeylonSafety] Owner alert: ${event}`;

    // AC3: owner_alert_email change → send to OLD address (owner) and second_alert_email.
    if (event === "settings.owner_alert_email_change") {
      await sendEmail({
        to: owner,
        template: "owner_alert",
        relatedType: "owner_alert",
        relatedId: `${detail.auditRowId}-old`,
        subject,
        html,
        text,
      });
      if (second) {
        await sendEmail({
          to: second,
          template: "owner_alert",
          relatedType: "owner_alert",
          relatedId: `${detail.auditRowId}-second`,
          subject,
          html,
          text,
        });
      }
      return;
    }

    await sendEmail({
      to: owner,
      template: "owner_alert",
      relatedType: "owner_alert",
      relatedId: detail.auditRowId,
      subject,
      html,
      text,
    });
  } catch (err: unknown) {
    // AC6: never rethrow — log the failure class only, no PII.
    const name = err instanceof Error ? err.constructor.name : "UnknownError";
    console.error("[owner-alert] send failed:", name, "event:", event);
  }
}
