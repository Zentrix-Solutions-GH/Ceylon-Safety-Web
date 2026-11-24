// S-088 AC4 — download request rejected email

export interface DownloadRejectedEmailData {
  adminNote: string;
  supportEmail: string;
}

export function renderDownloadRejectedEmail(data: DownloadRejectedEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const { adminNote, supportEmail } = data;

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
          <h1 style="margin:0 0 16px;font-size:20px;color:#111827;">Your download request could not be approved</h1>
          <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
            Unfortunately, your request for an additional download was not approved.
          </p>
          <div style="background:#fef2f2;border-left:4px solid #E30613;padding:12px 16px;margin:0 0 24px;border-radius:4px;">
            <p style="margin:0;font-size:14px;color:#374151;">${escapeHtml(adminNote)}</p>
          </div>
          <p style="margin:0;font-size:14px;color:#6b7280;">
            If you believe this is an error, please contact us at
            <a href="mailto:${escapeHtml(supportEmail)}" style="color:#E30613;">${escapeHtml(supportEmail)}</a>.
          </p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  const text = `Ceylon Safety — Download request not approved

Unfortunately, your request for an additional download was not approved.

Note from our team: ${adminNote}

If you believe this is an error, please contact us at ${supportEmail}.`;

  return {
    subject: "Your download request could not be approved",
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
