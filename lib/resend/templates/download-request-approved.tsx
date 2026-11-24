// S-088 AC3 — download request approved email

export interface DownloadApprovedEmailData {
  downloadUrl: string;
  appUrl: string;
  supportEmail: string;
}

export function renderDownloadApprovedEmail(data: DownloadApprovedEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const { downloadUrl, supportEmail } = data;

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
          <h1 style="margin:0 0 16px;font-size:20px;color:#111827;">Your download request is approved</h1>
          <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
            Good news — your request for an additional download has been approved.
          </p>
          <p style="margin:0 0 8px;font-size:15px;color:#374151;line-height:1.6;">
            Click the button below to download your document. <strong>This link works once</strong> —
            use it on the device you want to save the file to.
          </p>
          <div style="margin:24px 0;">
            <a href="${escapeHtml(downloadUrl)}"
               style="display:inline-block;background:#E30613;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:15px;font-weight:600;">
              Download now
            </a>
          </div>
          <p style="margin:0 0 0;font-size:13px;color:#6b7280;">
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

  const text = `Ceylon Safety — Download request approved

Your request for an additional download has been approved.

Download your document here (link works once):
${downloadUrl}

Need help? Email us at ${supportEmail}.`;

  return {
    subject: "Your download request is approved",
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
