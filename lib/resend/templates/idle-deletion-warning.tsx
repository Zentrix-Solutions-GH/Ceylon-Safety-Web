// S-088 AC5 — idle account deletion warning (template only; cron job is Release 2)

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString("en-GB", {
    timeZone: "Asia/Colombo",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export interface IdleDeletionWarningEmailData {
  ownerEmail: string;
  deletionDate: string; // ISO string
  appUrl: string;
}

export function renderIdleDeletionWarningEmail(data: IdleDeletionWarningEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const { appUrl, deletionDate } = data;
  const dateStr = formatDate(deletionDate);
  const signInUrl = `${appUrl}/sign-in`;

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
          <h1 style="margin:0 0 16px;font-size:20px;color:#111827;">Your account will be deleted on ${escapeHtml(dateStr)}</h1>
          <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
            We have not seen any activity on your Ceylon Safety account for a long time.
            To comply with our data retention policy, the account will be permanently deleted on <strong>${escapeHtml(dateStr)}</strong>.
          </p>
          <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
            If you would like to keep your account, simply sign in before that date.
          </p>
          <a href="${escapeHtml(signInUrl)}"
             style="display:inline-block;background:#E30613;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:15px;font-weight:600;">
            Sign in to keep your account
          </a>
          <p style="margin:32px 0 0;font-size:13px;color:#6b7280;">
            If you have purchased documents, your order history and invoices will be retained as required by law.
            Any unused download links will no longer be accessible after deletion.
          </p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  const text = `Ceylon Safety — Your account will be deleted on ${dateStr}

We have not seen any activity on your Ceylon Safety account for a long time.
Your account will be permanently deleted on ${dateStr}.

To keep your account, sign in before that date:
${signInUrl}

If you have purchased documents, your order history and invoices will be retained as required by law.`;

  return {
    subject: `Important: your Ceylon Safety account will be deleted on ${dateStr}`,
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
