import "server-only";
import { Resend } from "resend";
import { serverConfig } from "@/lib/config";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

// Postgres unique-violation error code
const PG_UNIQUE_VIOLATION = "23505";

export interface SendEmailOptions {
  to: string;
  template: string;
  relatedType?: string;
  relatedId?: string;
  subject: string;
  html: string;
}

/**
 * Insert-first send wrapper.
 *
 * 1. Insert an email_logs row (status = 'queued').
 * 2. If unique index fires (same template + related_type + related_id already exists) → return.
 * 3. Call Resend. On success: update status='sent', provider_message_id.
 *    On failure: update status='failed', error=<error class/code only>.
 * 4. The update step never throws — a send failure must not break sign-in / sign-up.
 */
export async function sendEmail(opts: SendEmailOptions): Promise<void> {
  const db = createSupabaseServiceRoleClient();

  // Step 1: insert log row and capture the new row's id for precise updates
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
    // Unique constraint → already sent for this (template, related_type, related_id)
    if ((insertError as { code?: string }).code === PG_UNIQUE_VIOLATION) {
      return;
    }
    // Any other DB error — we cannot track this send, so skip it rather than
    // risk a duplicate later. Propagate so the caller can log context.
    throw insertError;
  }

  const logId = (insertData as { id: number } | null)?.id;
  if (!logId) {
    // Insert succeeded but returned no id — cannot track the send precisely; skip.
    return;
  }

  // Step 2: send via Resend
  const resend = new Resend(serverConfig.resendApiKey);
  try {
    const { data, error: sendError } = await resend.emails.send({
      from: serverConfig.emailFrom,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });

    if (sendError || !data) {
      const errorCode =
        (sendError as { name?: string } | null)?.name ?? "send_failed";
      await db
        .from("email_logs")
        .update({ status: "failed", error: String(errorCode).slice(0, 120) })
        .eq("id", logId!);
      return;
    }

    await db
      .from("email_logs")
      .update({ status: "sent", provider_message_id: data.id ?? null })
      .eq("id", logId!);
  } catch (err: unknown) {
    // Resend unreachable or threw synchronously — use constructor name only (no message content)
    const name = err instanceof Error ? err.constructor.name : "";
    const errorCode = name && name !== "Error" ? name : "network_error";
    await db
      .from("email_logs")
      .update({ status: "failed", error: errorCode })
      .eq("id", logId!);
  }
}

/**
 * Convenience wrapper — sends the welcome email once per user.
 * The unique index on email_logs (template='welcome', related_type='user', related_id=userId)
 * guarantees at-most-one delivery even if called from both verifyEmail and the Google callback.
 */
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
