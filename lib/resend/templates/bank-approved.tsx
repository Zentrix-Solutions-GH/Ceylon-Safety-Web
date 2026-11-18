// S-086: bank-approved email template renderer
// AC3 — same content as receipt plus a "link works once" note

import { renderReceiptEmail, type ReceiptEmailData } from "@/lib/resend/templates/purchase-receipt";

export function renderBankApprovedEmail(data: ReceiptEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const { html, text, subject: baseSubject } = renderReceiptEmail(data);

  const onceNoteHtml = `<p style="margin:16px 0 0;font-size:14px;color:#374151;background:#fff7ed;border-left:3px solid #E30613;padding:12px;">
  Please note: each download link works once. Use it on the device you wish to save the file to.
</p>`;
  const onceNoteText = "\nNote: Each download link works once. Use it on the device you wish to save the file to.\n";

  // Insert the note after the invoice line in the HTML body
  const htmlWithNote = html.replace(
    "</p>\n\n              <p",
    `</p>\n\n              ${onceNoteHtml}\n\n              <p`,
  );

  return {
    subject: baseSubject.replace("Your receipt", "Your order is approved"),
    html: htmlWithNote,
    text: text + onceNoteText,
  };
}
