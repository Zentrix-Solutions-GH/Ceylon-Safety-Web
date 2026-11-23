// S-087: font embedding tests (AC3, EC2 - Latin, Sinhala, Tamil names)
import { describe, it, expect } from "vitest";
import { renderToString } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { createElement } from "react";
import { InvoiceDocument } from "@/lib/invoices/template";

function makeOrder(firstName: string, lastName: string, address: string) {
  return {
    id: "order-1",
    payment_method: "card" as const,
    total_cents: 100000,
    billing_snapshot: {
      firstName,
      lastName,
      email: "buyer@example.com",
      address,
      city: "Colombo",
      company: null,
      taxId: null,
    },
    coupon_snapshot: null,
  };
}

const baseInvoice = {
  invoice_number: "INV-2026-00001",
  issued_at: "2026-11-01T10:00:00Z",
  seller_snapshot: { name: "Ceylon Safety Ltd", address: "Colombo 03" },
  tax_label: null,
  tax_rate_bps: null,
  tax_cents: 0,
};

const oneItem = [
  { document_id: "doc-1", title_en: "Safety Checklist", language: "en", unit_price_cents: 100000 },
];

describe("InvoiceDocument fonts (AC3, EC2)", () => {
  it("AC3: renders without error with a Latin name", async () => {
    const order = makeOrder("Kasun", "Perera", "No 1, Main Street, Colombo");
    await expect(
      renderToString(createElement(InvoiceDocument, { order, items: oneItem, invoice: baseInvoice }) as unknown as ReactElement<DocumentProps>)
    ).resolves.toBeTruthy();
  });

  it("AC3: renders without error with a Sinhala name", async () => {
    // කසුන් පෙරේරා
    const order = makeOrder("කසුන්", "පෙරේරා", "No 1, ප්‍රධාන වීදිය, කොළඹ");
    await expect(
      renderToString(createElement(InvoiceDocument, { order, items: oneItem, invoice: baseInvoice }) as unknown as ReactElement<DocumentProps>)
    ).resolves.toBeTruthy();
  });

  it("AC3: renders without error with a Tamil name", async () => {
    // கசுன் பெரேரா
    const order = makeOrder("கசுன்", "பெரேரா", "No 1, முதன்மை தெரு, கொழும்பு");
    await expect(
      renderToString(createElement(InvoiceDocument, { order, items: oneItem, invoice: baseInvoice }) as unknown as ReactElement<DocumentProps>)
    ).resolves.toBeTruthy();
  });

  it("EC2: very long Sinhala address does not throw", async () => {
    const order = makeOrder(
      "කසුන්",
      "පෙරේරා",
      "අංක 1, ඉතා දිගු ආයතනයේ නාමය ඇතුලත් වන දිගු ලිපිනය, කොළඹ 03, ශ්‍රී ලංකාව"
    );
    await expect(
      renderToString(createElement(InvoiceDocument, { order, items: oneItem, invoice: baseInvoice }) as unknown as ReactElement<DocumentProps>)
    ).resolves.toBeTruthy();
  });

  it("EC2: very long Tamil address does not throw", async () => {
    const order = makeOrder(
      "கசுன்",
      "பெரேரா",
      "இல 1, மிகவும் நீண்ட நிறுவனத்தின் பெயரை உள்ளடக்கிய நீண்ட முகவரி, கொழும்பு 03, இலங்கை"
    );
    await expect(
      renderToString(createElement(InvoiceDocument, { order, items: oneItem, invoice: baseInvoice }) as unknown as ReactElement<DocumentProps>)
    ).resolves.toBeTruthy();
  });
});
