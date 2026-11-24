// S-088 AC1 — bank transfer slip rejected email

export interface BankRejectedEmailData {
  reason: string;
  orderPageUrl: string;
  supportEmail: string;
}

export function renderBankRejectedEmail(data: BankRejectedEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const { reason, orderPageUrl, supportEmail } = data;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 16px;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;">
      <tr>
        <td style="background:#E30613;padding:24px 32px;">
          <span style="color:#ffffff;font-size:20px;font-weight:700;">Ceylon Safety</span>
        </td>
      </tr>
      <tr>
        <td style="padding:32px;">
          <h1 style="margin:0 0 16px;font-size:20px;color:#111827;">Bank transfer slip rejected</h1>
          <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
            We were unable to verify your bank transfer slip. The reason given by our team:
          </p>
          <div style="background:#fef2f2;border-left:4px solid #E30613;padding:12px 16px;margin:0 0 24px;border-radius:4px;">
            <p style="margin:0;font-size:14px;color:#374151;">${escapeHtml(reason)}</p>
          </div>
          <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
            Please upload a new, clear bank transfer slip. Make sure the deposit details are legible.
          </p>
          <a href="${escapeHtml(orderPageUrl)}"
             style="display:inline-block;background:#E30613;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:15px;font-weight:600;">
            Upload new slip
          </a>
          <p style="margin:32px 0 0;font-size:13px;color:#6b7280;">
            If you need help, contact us at
            <a href="mailto:${escapeHtml(supportEmail)}" style="color:#E30613;">${escapeHtml(supportEmail)}</a>.
          </p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  const text = `Ceylon Safety — Bank transfer slip rejected

We were unable to verify your bank transfer slip.

Reason: ${reason}

Please upload a new, clear slip at:
${orderPageUrl}

Need help? Email us at ${supportEmail}.`;

  return {
    subject: "Action required: your bank transfer slip was rejected",
    html,
    text,
  };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
