import "server-only";
import { Resend } from "resend";
import { serverConfig } from "@/lib/config";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { raiseEmailAlert } from "@/lib/admin/alert";
import type { EmailTemplate } from "@/types/order";

// Postgres unique-violation error code
const PG_UNIQUE_VIOLATION = "23505";

// Back-off delays in ms for attempts 1, 2, 3 (index 0 = first retry after first failure).
const BACKOFF_MS = [1000, 2000, 4000];
const MAX_ATTEMPTS = 3;

interface ResendSendResult {
  data: { id?: string | null } | null;
  error: { name?: string; statusCode?: number; message?: string } | null;
}

async function callResendWithRetry(
  resend: Resend,
  payload: { from: string; to: string; subject: string; html: string; text?: string }
): Promise<ResendSendResult> {
  let lastResult: ResendSendResult = { data: null, error: null };

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt - 1]));
    }

    try {
      const result = await resend.emails.send(payload);
      const r = result as ResendSendResult;

      if (!r.error) return r;

      // Permanent 4xx (not 429) — do not retry
      const code = r.error.statusCode;
      if (code !== undefined && code < 500 && code !== 429) {
        return r;
      }

      lastResult = r;
    } catch (err: unknown) {
      // Network error — treat as retryable
      const name = err instanceof Error ? err.constructor.name : "";
      lastResult = {
        data: null,
        error: {
          name: name && name !== "Error" ? name : "network_error",
          statusCode: undefined,
          message: "",
        },
      };
    }
  }

  return lastResult;
}

export interface SendEmailOptions {
  to: string;
  template: EmailTemplate;
  relatedType?: string;
  relatedId?: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Insert-first send wrapper.
 *
 * 1. Insert an email_logs row (status = 'queued').
 * 2. If unique index fires (same template + related_type + related_id already exists) → return.
 * 3. Call Resend with up to 3 retries on 5xx/network errors (AC7).
 * 4. Update status to 'sent' or 'failed' — never throws.
 */
export async function sendEmail(opts: SendEmailOptions): Promise<void> {
  if (opts.relatedType && !opts.relatedId) {
    throw new Error(`sendEmail: relatedId is required when relatedType is set (got relatedType="${opts.relatedType}")`);
  }

  if (!opts.text) {
    console.warn("sendEmail: text part missing for template", opts.template);
  }

  const db = createSupabaseServiceRoleClient();

  const { data: insertData, error: insertError } = await db
    .from("email_logs")
    .insert({
      to_email: opts.to,
      template: opts.template,
      related_type: opts.relatedType ?? null,
      related_id: opts.relatedId ?? null,
      status: "queued",
    })
    .select("id")
    .single();

  if (insertError) {
    if ((insertError as { code?: string }).code === PG_UNIQUE_VIOLATION) {
      return;
    }
    throw insertError;
  }

  const logId = (insertData as { id: number } | null)?.id;
  if (!logId) {
    console.error("[email] insert returned no id — send skipped (template=%s)", opts.template);
    return;
  }

  const resend = new Resend(serverConfig.resendApiKey);
  const result = await callResendWithRetry(resend, {
    from: serverConfig.emailFrom,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    ...(opts.text ? { text: opts.text } : {}),
  });

  if (result.error || !result.data) {
    // Sanitise: store only the error class name, never message text (AC9 — no PII in logs)
    const errorName = result.error?.name ?? "send_failed";
    const safeCode = String(errorName).slice(0, 120);
    await db
      .from("email_logs")
      .update({ status: "failed", error: safeCode })
      .eq("id", logId);
    raiseEmailAlert({ logId, template: opts.template, errorName: safeCode });
    return;
  }

  await db
    .from("email_logs")
    .update({ status: "sent", provider_message_id: result.data.id ?? null })
    .eq("id", logId);
}

export interface SendQueuedEmailOptions {
  template: EmailTemplate;
  relatedType: string;
  relatedId: string;
  renderEmail: (to: string) => { subject: string; html: string; text?: string };
}

/**
 * Send an email whose email_logs row was already inserted (by a DB function or action)
 * with status = 'queued'. Fetches the row, calls Resend with retry, and updates status.
 *
 * Used for: bank_rejected, download_request_approved, download_request_rejected,
 * bank_expiring (when queued by the job before calling this).
 */
export async function sendQueuedEmail(opts: SendQueuedEmailOptions): Promise<void> {
  const db = createSupabaseServiceRoleClient();

  const { data: row } = await db
    .from("email_logs")
    .select("id, to_email")
    .eq("template", opts.template)
    .eq("related_type", opts.relatedType)
    .eq("related_id", opts.relatedId)
    .eq("status", "queued")
    .maybeSingle();

  if (!row) return;

  const logRow = row as { id: number; to_email: string };
  const { subject, html, text } = opts.renderEmail(logRow.to_email);

  const resend = new Resend(serverConfig.resendApiKey);
  const result = await callResendWithRetry(resend, {
    from: serverConfig.emailFrom,
    to: logRow.to_email,
    subject,
    html,
    ...(text ? { text } : {}),
  });

  if (result.error || !result.data) {
    const errorName = result.error?.name ?? "send_failed";
    const safeCode = String(errorName).slice(0, 120);
    await db
      .from("email_logs")
      .update({ status: "failed", error: safeCode })
      .eq("id", logRow.id);
    raiseEmailAlert({ logId: logRow.id, template: opts.template, errorName: safeCode });
    return;
  }

  await db
    .from("email_logs")
    .update({ status: "sent", provider_message_id: result.data.id ?? null })
    .eq("id", logRow.id);
}

export async function sendWelcomeEmail(email: string, userId: string): Promise<void> {
  const { renderWelcomeEmail } = await import("@/lib/resend/templates/welcome");
  const { subject, html } = renderWelcomeEmail();
  await sendEmail({
    to: email,
    template: "welcome",
    relatedType: "user",
    relatedId: userId,
    subject,
    html,
  });
}
