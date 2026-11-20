// S-086: bank-approved email template renderer
// AC3 — same content as receipt plus a "link works once" note

import { renderReceiptEmail, type ReceiptEmailData } from "@/lib/resend/templates/purchase-receipt";

export function renderBankApprovedEmail(data: ReceiptEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const { html, text, subject: baseSubject } = renderReceiptEmail({ ...data, onceNote: true });

  return {
    subject: baseSubject.replace("Your receipt", "Your order is approved"),
    html,
    text,
  };
}
