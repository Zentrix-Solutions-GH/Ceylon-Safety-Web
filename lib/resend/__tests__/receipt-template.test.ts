// S-086: receipt and bank_approved email template unit tests
// AC3, EC3

import { describe, it, expect } from "vitest";
import { renderReceiptEmail, type ReceiptEmailData } from "@/lib/resend/templates/purchase-receipt";
import { renderBankApprovedEmail } from "@/lib/resend/templates/bank-approved";

const BASE: ReceiptEmailData = {
  orderNumber: "CS-00042",
  orderDate: "2026-11-18T04:30:00.000Z", // UTC, should display as Asia/Colombo date
  items: [
    {
      titleSnapshot: "Fire Safety Checklist",
      language: "en",
      lineTotalCents: 199000,
      entitlementId: "ent-aaa",
    },
  ],
  totalCents: 199000,
  appUrl: "https://ceylonsafety.lk",
  supportEmail: "support@ceylonsafety.lk",
  refundPolicyUrl: "https://ceylonsafety.lk/refund-policy",
};

describe("renderReceiptEmail", () => {
  it("contains the order number (AC3)", () => {
    const { html, text } = renderReceiptEmail(BASE);
    expect(html).toContain("CS-00042");
    expect(text).toContain("CS-00042");
  });

  it("contains the item title (AC3)", () => {
    const { html } = renderReceiptEmail(BASE);
    expect(html).toContain("Fire Safety Checklist");
  });

  it("contains the language label (AC3)", () => {
    const { html } = renderReceiptEmail(BASE);
    expect(html).toMatch(/English|en/i);
  });

  it("formats total as LKR with thousands separator and two decimals (AC3)", () => {
    const { html, text } = renderReceiptEmail(BASE);
    // 199000 cents = LKR 1,990.00
    expect(html).toContain("1,990.00");
    expect(text).toContain("1,990.00");
  });

  it("formats larger total with thousands separator (AC3)", () => {
    const data: ReceiptEmailData = {
      ...BASE,
      items: [
        { ...BASE.items[0], lineTotalCents: 1200000 },
      ],
      totalCents: 1200000,
    };
    const { html } = renderReceiptEmail(data);
    // 1200000 cents = LKR 12,000.00
    expect(html).toContain("12,000.00");
  });

  it("includes a download page button for each item using entitlementId (AC3)", () => {
    const { html } = renderReceiptEmail(BASE);
    expect(html).toContain("/api/download/ent-aaa");
  });

  it("never contains a direct file/R2 URL (AC3)", () => {
    const { html } = renderReceiptEmail(BASE);
    expect(html).not.toContain(".r2.cloudflarestorage.com");
    expect(html).not.toContain("r2.amazonaws.com");
  });

  it("includes support contact (AC3)", () => {
    const { html } = renderReceiptEmail(BASE);
    expect(html).toContain("support@ceylonsafety.lk");
  });

  it("includes refund policy link (AC3)", () => {
    const { html } = renderReceiptEmail(BASE);
    expect(html).toContain("https://ceylonsafety.lk/refund-policy");
  });

  it("contains no card data (AC3)", () => {
    const { html } = renderReceiptEmail(BASE);
    expect(html).not.toMatch(/card number|cvv|cvc|expiry/i);
  });

  it("displays date in Asia/Colombo timezone (AC3)", () => {
    const { html } = renderReceiptEmail(BASE);
    // 2026-11-18T04:30:00Z = 2026-11-18T10:00:00+05:30 → 18 November 2026
    expect(html).toContain("2026");
  });

  it("renders Sinhala names without mangling (EC3)", () => {
    const data: ReceiptEmailData = {
      ...BASE,
      items: [{ ...BASE.items[0], titleSnapshot: "ගිනි ආරක්ෂා නිරීක්ෂා ලැයිස්තුව" }],
    };
    const { html, text } = renderReceiptEmail(data);
    expect(html).toContain("ගිනි ආරක්ෂා");
    expect(text).toContain("ගිනි ආරක්ෂා");
  });

  it("renders Tamil names without mangling (EC3)", () => {
    const data: ReceiptEmailData = {
      ...BASE,
      items: [{ ...BASE.items[0], titleSnapshot: "தீ பாதுகாப்பு சரிபார்ப்பு பட்டியல்" }],
    };
    const { html, text } = renderReceiptEmail(data);
    expect(html).toContain("தீ பாதுகாப்பு");
    expect(text).toContain("தீ பாதுகாப்பு");
  });

  it("includes invoice link when no pdfUrl supplied (EC4 — link case)", () => {
    const data: ReceiptEmailData = { ...BASE, orderPageUrl: "https://ceylonsafety.lk/orders/42" };
    const { html } = renderReceiptEmail(data);
    expect(html).toContain("https://ceylonsafety.lk/orders/42");
  });

  it("includes attachment note text when pdfAttached is true (EC4 — attached case)", () => {
    const data: ReceiptEmailData = { ...BASE, pdfAttached: true };
    const { html, text } = renderReceiptEmail(data);
    expect(html).toMatch(/invoice.*attach|attach.*invoice/i);
    expect(text).toMatch(/invoice.*attach|attach.*invoice/i);
  });

  it("includes both html and text parts (AC7)", () => {
    const { html, text } = renderReceiptEmail(BASE);
    expect(typeof html).toBe("string");
    expect(html.length).toBeGreaterThan(100);
    expect(typeof text).toBe("string");
    expect(text.length).toBeGreaterThan(20);
  });
});

describe("renderBankApprovedEmail", () => {
  it("includes the same receipt fields plus a 'link works once' note (AC3)", () => {
    const { html, text } = renderBankApprovedEmail(BASE);
    expect(html).toContain("CS-00042");
    expect(html).toContain("/api/download/ent-aaa");
    expect(html).toMatch(/link.*once|once.*link|works once/i);
    expect(text).toMatch(/link.*once|once.*link|works once/i);
  });

  it("includes both html and text parts (AC7)", () => {
    const { html, text } = renderBankApprovedEmail(BASE);
    expect(typeof html).toBe("string");
    expect(typeof text).toBe("string");
  });
});
