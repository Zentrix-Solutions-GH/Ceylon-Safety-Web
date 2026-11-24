import "server-only";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/resend/client";
import { currentSlDate, slDayBoundaries } from "@/lib/alerts/email-budget";
import type { AuditEventName } from "@/types/audit";
import { escHtml } from "@/lib/alerts/render-utils";

// Money and settings events included in the digest (AC5).
// `satisfies` ensures every entry remains a valid AuditEventName — a rename in
// types/audit.ts will produce a compile error here rather than silently missing events.
const DIGEST_ACTIONS = [
  "order.paid",
  "order.grant",
  "order.chargeback",
  "bank_transfer.approve",
  "bank_transfer.reject",
  "download_request.approve",
  "download_request.reject",
  "price.change",
  "coupon.create",
  "coupon.update",
  "settings.change",
  "settings.contact_change",
  "settings.business_change",
] satisfies AuditEventName[];

type AuditRow = {
  id: number;
  action: string;
  created_at: string;
};

type HeldAlert = {
  id: number;
  event: string;
  detail: Record<string, unknown>;
  created_at: string;
};

function renderDigestHtml(auditRows: AuditRow[], heldAlerts: HeldAlert[]): string {
  const auditSection = auditRows.length
    ? `<h2>Events (last 24 h)</h2><ul>${auditRows
        .map((r) => `<li>${escHtml(r.created_at)} — ${escHtml(r.action)}</li>`)
        .join("")}</ul>`
    : "";
  const heldSection = heldAlerts.length
    ? `<h2>Held alerts</h2><ul>${heldAlerts
        .map((h) => {
          const actorName =
            typeof h.detail?.actorName === "string"
              ? ` by ${escHtml(h.detail.actorName)}`
              : "";
          return `<li>${escHtml(h.created_at)} — ${escHtml(h.event)}${actorName}</li>`;
        })
        .join("")}</ul>`
    : "";
  return `<p><strong>CeylonSafety — daily owner digest</strong></p>${auditSection}${heldSection}`;
}

function renderDigestText(auditRows: AuditRow[], heldAlerts: HeldAlert[]): string {
  const lines = ["CeylonSafety — daily owner digest", ""];
  if (auditRows.length) {
    lines.push("Events (last 24 h):");
    for (const r of auditRows) {
      lines.push(`  ${r.created_at} — ${r.action}`);
    }
    lines.push("");
  }
  if (heldAlerts.length) {
    lines.push("Held alerts:");
    for (const h of heldAlerts) {
      const actorName = typeof h.detail?.actorName === "string" ? ` by ${h.detail.actorName}` : "";
      lines.push(`  ${h.created_at} — ${h.event}${actorName}`);
    }
  }
  return lines.join("\n");
}

export async function ownerDigestJob(): Promise<{ ok: boolean }> {
  try {
    const db = createSupabaseServiceRoleClient();
    const slDate = currentSlDate();

    // Read owner_alert_email from settings.
    const { data: settingsRows } = await db
      .from("site_settings")
      .select("key, value")
      .in("key", ["owner_alert_email"]);
    const rows = (settingsRows ?? []) as Array<{ key: string; value: unknown }>;
    const ownerEmail = rows.find((r) => r.key === "owner_alert_email")?.value;
    if (typeof ownerEmail !== "string" || !ownerEmail) {
      return { ok: true };
    }

    // Read audit rows for the current SL calendar day (AC5).
    // Uses the same SL day as the idempotency key so the digest covers exactly
    // the rows that would be described as "today" to the owner.
    const since = slDayBoundaries(slDate).startUtc;
    const { data: auditData } = await db
      .from("admin_audit_log")
      .select("id, action, created_at")
      .gte("created_at", since)
      .in("action", DIGEST_ACTIONS)
      .order("created_at", { ascending: true });
    const auditRows = (auditData ?? []) as AuditRow[];

    // Read held alerts created before the end of the current SL day.
    // The upper bound prevents a race where an alert inserted after rendering
    // would be deleted without appearing in the email.
    const { data: heldData } = await db
      .from("owner_alert_held")
      .select("id, event, detail, created_at")
      .lt("created_at", slDayBoundaries(slDate).endUtc);
    const heldAlerts = (heldData ?? []) as HeldAlert[];

    // AC5: nothing to report → skip.
    if (auditRows.length === 0 && heldAlerts.length === 0) {
      return { ok: true };
    }

    // EC3: idempotent by (owner_digest, owner_digest, SL date string).
    await sendEmail({
      to: ownerEmail,
      template: "owner_digest",
      relatedType: "owner_digest",
      relatedId: slDate,
      subject: `[CeylonSafety] Daily owner digest ${slDate}`,
      html: renderDigestHtml(auditRows, heldAlerts),
      text: renderDigestText(auditRows, heldAlerts),
    });

    // Clear held alerts that were included.
    // Wrapped separately: a delete failure must not set ok:false after a successful send,
    // which would prevent future runs from ever reaching the delete (idempotency blocks re-send).
    if (heldAlerts.length > 0) {
      const ids = heldAlerts.map((h) => h.id);
      try {
        await db.from("owner_alert_held").delete().in("id", ids);
      } catch (delErr: unknown) {
        const delName = delErr instanceof Error ? delErr.constructor.name : "UnknownError";
        console.error("[owner-digest] held-alert delete failed:", delName);
      }
    }

    return { ok: true };
  } catch (err: unknown) {
    const name = err instanceof Error ? err.constructor.name : "UnknownError";
    console.error("[owner-digest] job failed:", name);
    return { ok: false };
  }
}
