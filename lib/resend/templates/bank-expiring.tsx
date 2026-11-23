// S-088 AC2 — bank order expiry warning email

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString("en-GB", {
    timeZone: "Asia/Colombo",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export interface BankExpiringEmailData {
  orderNumber: string;
  expiryDate: string; // ISO string
  appUrl: string;
}

export function renderBankExpiringEmail(data: BankExpiringEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const { orderNumber, expiryDate, appUrl } = data;
  const dateStr = formatDate(expiryDate);
  const ordersUrl = `${appUrl}/orders`;

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
          <h1 style="margin:0 0 16px;font-size:20px;color:#111827;">Your bank transfer order is expiring soon</h1>
          <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
            Order <strong>${escapeHtml(orderNumber)}</strong> requires a verified bank transfer slip.
            If we do not receive a valid slip by <strong>${escapeHtml(dateStr)}</strong>, the order will be cancelled.
          </p>
          <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
            Please sign in and upload your slip as soon as possible.
          </p>
          <a href="${escapeHtml(ordersUrl)}"
             style="display:inline-block;background:#E30613;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:15px;font-weight:600;">
            View your orders
          </a>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  const text = `Ceylon Safety — Bank transfer order expiring

Order ${orderNumber} will be cancelled if we do not receive a valid bank transfer slip by ${dateStr}.

Please sign in and upload your slip:
${ordersUrl}`;

  return {
    subject: `Action required: Order ${orderNumber} expires on ${dateStr}`,
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
