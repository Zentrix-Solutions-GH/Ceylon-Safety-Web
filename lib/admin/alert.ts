import "server-only";

export interface EmailAlertPayload {
  // NOTE: email_logs.id is BIGINT; Supabase JS types it as number. For IDs above 2^53
  // the JS number loses precision. Acceptable for typical volumes; revisit if logs table
  // grows to billions of rows.
  logId: number;
  template: string;
  errorName: string;
}

// Structured alert for a permanently failed email send.
// S-100 will replace this stub with a real notification channel.
export function raiseEmailAlert(payload: EmailAlertPayload): void {
  console.error("[ALERT] email send failed permanently", {
    log_id: payload.logId,
    template: payload.template,
    error: payload.errorName,
  });
}
