// S-086: receipt email template renderer
// AC3, AC7, EC3, EC4

export interface ReceiptEmailData {
  orderNumber: string;
  orderDate: string; // ISO string — displayed in Asia/Colombo
  items: Array<{
    titleSnapshot: string;
    language: string;
    lineTotalCents: number;
    entitlementId: string;
  }>;
  totalCents: number;
  appUrl: string;
  supportEmail: string;
  refundPolicyUrl: string;
  /** Set to true when the invoice PDF is attached in this same finalize run (EC4). */
  pdfAttached?: boolean;
  /** Set when the invoice is not yet ready; shown as a link instead (EC4). */
  orderPageUrl?: string;
  /** Set to true for bank_approved emails to show a "link works once" note. */
  onceNote?: boolean;
}

function formatLkr(cents: number): string {
  const lkr = cents / 100;
  return lkr.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString("en-GB", {
    timeZone: "Asia/Colombo",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function languageLabel(lang: string): string {
  if (lang === "si") return "Sinhala";
  if (lang === "ta") return "Tamil";
  return "English";
}

export function renderReceiptEmail(data: ReceiptEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const { orderNumber, orderDate, items, totalCents, appUrl, supportEmail, refundPolicyUrl, onceNote } = data;
  const dateStr = formatDate(orderDate);
  const totalStr = formatLkr(totalCents);

  const onceNoteHtml = onceNote
    ? `<p style="margin:16px 0 0;font-size:14px;color:#374151;background:#fff7ed;border-left:3px solid #E30613;padding:12px;">
  Please note: each download link works once. Use it on the device you wish to save the file to.
</p>`
    : "";
  const onceNoteText = onceNote
    ? "\nNote: Each download link works once. Use it on the device you wish to save the file to.\n"
    : "";

  const invoiceNote = data.pdfAttached
    ? "Your invoice is attached to this email."
    : data.orderPageUrl
      ? `Your invoice is being prepared. <a href="${data.orderPageUrl}" style="color:#E30613;">View your order</a> for the invoice when it is ready.`
      : "Your invoice will appear on your order page when it is ready.";

  const invoiceNoteText = data.pdfAttached
    ? "Your invoice is attached to this email."
    : data.orderPageUrl
      ? `Your invoice is being prepared. View your order at ${data.orderPageUrl} when it is ready.`
      : "Your invoice will appear on your order page when it is ready.";

  const itemRowsHtml = items
    .map(
      (item) => `
      <tr>
        <td style="padding:8px 0;font-size:14px;color:#374151;border-bottom:1px solid #f3f4f6;">
          ${item.titleSnapshot} (${languageLabel(item.language)})
        </td>
        <td style="padding:8px 0;font-size:14px;color:#374151;text-align:right;border-bottom:1px solid #f3f4f6;">
          LKR ${formatLkr(item.lineTotalCents)}
        </td>
      </tr>
      <tr>
        <td colspan="2" style="padding:4px 0 12px;">
          <a href="${appUrl}/api/download/${item.entitlementId}"
             style="display:inline-block;background:#E30613;color:#ffffff;font-size:13px;font-weight:600;padding:8px 16px;border-radius:4px;text-decoration:none;">
            Download now
          </a>
        </td>
      </tr>`,
    )
    .join("");

  const itemRowsText = items
    .map(
      (item) =>
        `- ${item.titleSnapshot} (${languageLabel(item.language)}): LKR ${formatLkr(item.lineTotalCents)}\n  Download: ${appUrl}/api/download/${item.entitlementId}`,
    )
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your receipt — Ceylon Safety</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:560px;">
          <tr>
            <td style="background:#E30613;padding:28px 32px;">
              <span style="color:#ffffff;font-size:22px;font-weight:bold;letter-spacing:-0.5px;">Ceylon Safety</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 8px;font-size:20px;color:#111827;">Your receipt</h1>
              <p style="margin:0 0 4px;font-size:14px;color:#6b7280;">Order ${orderNumber} &mdash; ${dateStr}</p>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
                ${itemRowsHtml}
                <tr>
                  <td style="padding:12px 0 0;font-size:15px;font-weight:bold;color:#111827;">Total</td>
                  <td style="padding:12px 0 0;font-size:15px;font-weight:bold;color:#111827;text-align:right;">LKR ${totalStr}</td>
                </tr>
              </table>

              <p style="margin:0 0 16px;font-size:14px;color:#374151;">${invoiceNote}</p>
              ${onceNoteHtml}

              <p style="margin:0 0 8px;font-size:14px;color:#374151;">
                Need help? Contact us at <a href="mailto:${supportEmail}" style="color:#E30613;">${supportEmail}</a>
              </p>
              <p style="margin:0;font-size:14px;color:#374151;">
                <a href="${refundPolicyUrl}" style="color:#E30613;">Refund policy</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 28px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                Ceylon Safety &mdash; Keeping Sri Lanka's workplaces safe.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `Your receipt — Ceylon Safety

Order: ${orderNumber}
Date: ${dateStr}

Items:
${itemRowsText}

Total: LKR ${totalStr}

${invoiceNoteText}${onceNoteText}
Need help? ${supportEmail}
Refund policy: ${refundPolicyUrl}

Ceylon Safety — Keeping Sri Lanka's workplaces safe.`;

  const subject = `Your receipt — Order ${orderNumber}`;

  return { subject, html, text };
}
