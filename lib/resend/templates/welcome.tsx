// Welcome email template — S-040
// Plain HTML string approach: no react-email dependency required.

import { publicConfig } from "@/lib/config";

export function renderWelcomeEmail(): { subject: string; html: string } {
  const appUrl = publicConfig.appUrl;
  const subject = "Welcome to Ceylon Safety";
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to Ceylon Safety</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:560px;">
          <tr>
            <td style="background:#16a34a;padding:28px 32px;">
              <span style="color:#ffffff;font-size:22px;font-weight:bold;letter-spacing:-0.5px;">Ceylon Safety</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 16px;font-size:20px;color:#111827;">Welcome to Ceylon Safety</h1>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;">
                Thank you for joining Ceylon Safety — your trusted source for health &amp; safety resources in Sri Lanka.
              </p>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#374151;">
                You now have access to free articles, safety videos, and a growing library of professional safety documents including checklists, safety signs, and toolbox talks.
              </p>
              <a href="${appUrl}"
                 style="display:inline-block;background:#16a34a;color:#ffffff;font-size:15px;font-weight:600;padding:12px 24px;border-radius:6px;text-decoration:none;">
                Browse resources
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 28px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                Ceylon Safety &mdash; Keeping Sri Lanka's workplaces safe.<br />
                If you did not create this account, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}
