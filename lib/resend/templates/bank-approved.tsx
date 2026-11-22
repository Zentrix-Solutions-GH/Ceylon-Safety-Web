// S-086: bank-approved email template renderer
// AC3 — same content as receipt plus a "link works once" note

import { renderReceiptEmail, type ReceiptEmailData } from "@/lib/resend/templates/purchase-receipt";

export function renderBankApprovedEmail(data: ReceiptEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const { html, text } = renderReceiptEmail({ ...data, onceNote: true });

  return {
    subject: `Your order is approved — Order ${data.orderNumber}`,
    html,
    text,
  };
}
