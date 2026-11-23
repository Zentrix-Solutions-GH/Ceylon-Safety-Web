// S-088 AC6 — account deletion OTP template stub
// Note: Supabase Auth sends the deletion OTP via its magic-link template through Resend SMTP.
// This template is a reference implementation used if the OTP is ever sent via our server.

export interface AccountDeletionOtpEmailData {
  otp: string; // 6-digit code
  appUrl: string;
}

export function renderAccountDeletionOtpEmail(data: AccountDeletionOtpEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const { otp, appUrl } = data;

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
          <h1 style="margin:0 0 16px;font-size:20px;color:#111827;">Confirm account deletion</h1>
          <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
            You requested to delete your Ceylon Safety account. Enter the code below to confirm.
            This code expires in 10 minutes.
          </p>
          <div style="text-align:center;margin:24px 0;padding:20px;background:#f9fafb;border-radius:8px;">
            <span style="font-size:36px;font-weight:700;letter-spacing:0.2em;color:#111827;">${escapeHtml(otp)}</span>
          </div>
          <p style="margin:0 0 0;font-size:13px;color:#6b7280;">
            If you did not request this, please ignore this email or visit
            <a href="${escapeHtml(appUrl)}" style="color:#E30613;">${escapeHtml(appUrl)}</a> to secure your account.
          </p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  const text = `Ceylon Safety — Confirm account deletion

Your confirmation code: ${otp}

This code expires in 10 minutes.

If you did not request this, please ignore this email.`;

  return {
    subject: "Your account deletion code",
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
