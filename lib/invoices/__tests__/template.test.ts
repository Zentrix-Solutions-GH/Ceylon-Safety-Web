// S-087: InvoiceDocument template tests (AC2, AC4, EC2, EC5)
// Tests verify that the React-PDF component renders to a valid PDF buffer
// and that the element tree contains the expected values.
import { describe, it, expect } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { createElement } from "react";
import { InvoiceDocument } from "@/lib/invoices/template";

const baseSeller = { name: "Ceylon Safety Ltd", address: "No 15, Duplication Road, Colombo 03" };

const baseOrder = {
  id: "order-1",
  payment_method: "card" as const,
  total_cents: 150000,
  billing_snapshot: {
    firstName: "Kasun",
    lastName: "Perera",
    email: "kasun@example.com",
    address: "No 1, Main Street",
    city: "Colombo",
    company: null,
    taxId: null,
  },
  coupon_snapshot: null,
};

const baseInvoice = {
  invoice_number: "INV-2026-00001",
  issued_at: "2026-11-01T10:00:00Z",
  seller_snapshot: baseSeller,
  tax_label: null,
  tax_rate_bps: null,
  tax_cents: 0,
};

const oneItem = [
  { document_id: "doc-1", title_en: "Safety Checklist", language: "en", unit_price_cents: 150000 },
];

function makeThirtyItems() {
  return Array.from({ length: 30 }, (_, i) => ({
    document_id: `doc-${i + 1}`,
    title_en: `Safety Document ${i + 1}`,
    language: "en",
    unit_price_cents: 5000,
  }));
}

function getElement(
  order = baseOrder,
  items = oneItem,
  invoice = baseInvoice,
) {
  return createElement(InvoiceDocument, { order, items, invoice });
}

function flattenElement(
  order = baseOrder,
  items = oneItem,
  invoice = baseInvoice,
): string {
  // Call the component function directly to get the rendered element tree
  // (createElement only serializes props; calling InvoiceDocument() expands computed values).
  const rendered = InvoiceDocument({ order, items, invoice });
  return JSON.stringify(rendered);
}

async function renderBuffer(
  order = baseOrder,
  items = oneItem,
  invoice = baseInvoice,
): Promise<Buffer> {
  const el = getElement(order, items, invoice) as unknown as ReactElement<DocumentProps>;
  const ab = await renderToBuffer(el);
  return Buffer.from(ab);
}

describe("InvoiceDocument", () => {
  it("AC2: element tree contains seller name", () => {
    const json = flattenElement();
    expect(json).toContain("Ceylon Safety Ltd");
  });

  it("AC2: element tree contains seller address", () => {
    const json = flattenElement();
    expect(json).toContain("Duplication Road");
  });

  it("AC2: element tree contains invoice number", () => {
    const json = flattenElement();
    expect(json).toContain("INV-2026-00001");
  });

  it("AC2: element tree contains legal title 'Invoice' (Q44b)", () => {
    const json = flattenElement();
    expect(json).toContain("Invoice");
  });

  it("AC2: element tree has no tax line (Q44a - no VAT/GST)", () => {
    const json = flattenElement();
    expect(json).not.toMatch(/VAT|Tax|GST/);
  });

  it("AC2: element tree contains buyer first name", () => {
    const json = flattenElement();
    expect(json).toContain("Kasun");
  });

  it("AC2: element tree contains buyer last name", () => {
    const json = flattenElement();
    expect(json).toContain("Perera");
  });

  it("AC2: element tree contains item title", () => {
    const json = flattenElement();
    expect(json).toContain("Safety Checklist");
  });

  it("AC2: element tree contains formatted total (150000 cents = 1,500.00)", () => {
    const json = flattenElement();
    expect(json).toContain("1,500.00");
  });

  it("AC2: element tree contains payment method 'card'", () => {
    const json = flattenElement().toLowerCase();
    expect(json).toContain("card");
  });

  it("AC2: element tree has no coupon/discount line when coupon_snapshot is null", () => {
    const json = flattenElement().toLowerCase();
    expect(json).not.toMatch(/discount|coupon/);
  });

  it("EC5: bank_transfer payment method text appears in element tree", () => {
    const order = { ...baseOrder, payment_method: "bank_transfer" as unknown as "card" };
    const json = flattenElement(order).toLowerCase();
    expect(json).toContain("bank");
  });

  it("AC4: renders to PDF buffer without error (1 item)", async () => {
    const buf = await renderBuffer();
    expect(buf.length).toBeGreaterThan(100);
    // PDF files start with %PDF-
    expect(buf.toString("utf8", 0, 4)).toBe("%PDF");
  });

  it("AC4: renders to PDF buffer without error (30 items)", async () => {
    const items = makeThirtyItems();
    const order = { ...baseOrder, total_cents: 30 * 5000 };
    const buf = await renderBuffer(order, items);
    expect(buf.length).toBeGreaterThan(100);
    expect(buf.toString("utf8", 0, 4)).toBe("%PDF");
  });

  it("AC4: total with 30 items (150000 cents) in element tree", () => {
    const items = makeThirtyItems();
    const order = { ...baseOrder, total_cents: 150000 };
    const json = flattenElement(order, items);
    expect(json).toContain("1,500.00");
  });

  it("AC2: element tree contains buyer taxId when present", () => {
    const order = {
      ...baseOrder,
      billing_snapshot: { ...baseOrder.billing_snapshot, taxId: "VAT123456" },
    } as unknown as typeof baseOrder;
    const json = flattenElement(order);
    expect(json).toContain("VAT123456");
  });

  it("AC2: element tree omits taxId line when taxId is null", () => {
    const json = flattenElement();
    expect(json).not.toContain("Tax ID:");
  });

  it("AC2: footer contains support email when support_email is set", () => {
    const invoice = { ...baseInvoice, support_email: "support@example.com" };
    const json = flattenElement(baseOrder, oneItem, invoice);
    expect(json).toContain("support@example.com");
  });

  it("AC2: footer omits contact line when support_email is not set", () => {
    const json = flattenElement();
    expect(json).not.toContain("contact");
  });

  it("EC2: long company name in billing does not throw", async () => {
    const order = {
      ...baseOrder,
      billing_snapshot: {
        ...baseOrder.billing_snapshot,
        company: "A Very Long Company Name That Might Overflow The Invoice Layout Entirely Without Proper Word Wrapping",
      },
    } as unknown as typeof baseOrder;
    await expect(renderBuffer(order)).resolves.toSatisfy((b: unknown) => (b as Buffer).length > 0);
  });
});
