import "server-only";

export interface EmailAlertPayload {
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
