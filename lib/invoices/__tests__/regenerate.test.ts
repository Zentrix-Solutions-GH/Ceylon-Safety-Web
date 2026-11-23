// S-087: regenerateInvoice tests (AC5, EC4)
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/invoices/pdf", () => ({ buildInvoicePdf: vi.fn() }));
vi.mock("@/lib/r2/storage", () => ({ putObject: vi.fn() }));
vi.mock("@/lib/config", () => ({
  r2Config: vi.fn(() => ({
    bucketPrivate: "test-private",
    accountId: "acct",
    accessKeyId: "key",
    secretAccessKey: "secret",
    publicMediaBaseUrl: "https://cdn.test",
  })),
}));

import { buildInvoicePdf } from "@/lib/invoices/pdf";
import { putObject } from "@/lib/r2/storage";
import { regenerateInvoice } from "@/lib/invoices/create";

const mockBuild = vi.mocked(buildInvoicePdf);
const mockPut = vi.mocked(putObject);

const frozenSnapshot = { name: "Ceylon Safety Ltd", address: "Colombo 03" };

const fakeInvoiceRow = {
  id: "inv-1",
  order_id: "order-1",
  invoice_number: "INV-2026-00001",
  issued_at: "2026-11-01T10:00:00Z",
  seller_snapshot: frozenSnapshot,
  tax_label: null,
  tax_rate_bps: null,
  tax_cents: 0,
  pdf_key: "invoices/order-1.pdf",
};

const fakeOrderRow = {
  id: "order-1",
  user_id: "user-1",
  status: "paid",
  payment_method: "card",
  total_cents: 150000,
  billing_snapshot: { firstName: "Kasun", lastName: "Perera", email: "kasun@example.com", address: "No 1, Main Street", city: "Colombo" },
  coupon_snapshot: null,
};

const fakeItems = [
  { document_id: "doc-1", title_snapshot: "Safety Checklist", language: "en", unit_price_cents: 150000 },
];

function makeSupabase(options: {
  invoiceRow?: typeof fakeInvoiceRow | null;
  invoiceError?: { message: string } | null;
  updateError?: { message: string } | null;
} = {}) {
  const { invoiceRow = fakeInvoiceRow, invoiceError = null, updateError = null } = options;

  const fromMock = vi.fn().mockImplementation((table: string) => {
    if (table === "invoices") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: invoiceRow, error: invoiceError }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: updateError }),
        }),
      };
    }
    if (table === "orders") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: fakeOrderRow, error: null }),
          }),
        }),
      };
    }
    if (table === "order_items") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: fakeItems, error: null }),
        }),
      };
    }
    if (table === "site_settings") {
      return {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({
            data: [{ key: "contact_email", value: "support@ceylonsafety.lk" }],
            error: null,
          }),
        }),
      };
    }
    return { select: vi.fn().mockReturnThis() };
  });

  return { from: fromMock } as unknown as Parameters<typeof regenerateInvoice>[1];
}

beforeEach(() => {
  vi.clearAllMocks();
  mockBuild.mockResolvedValue(Buffer.from("REGEN-PDF"));
  mockPut.mockResolvedValue(undefined);
});

describe("regenerateInvoice", () => {
  it("AC5: uses the STORED seller_snapshot, not current settings", async () => {
    const sb = makeSupabase();
    await regenerateInvoice("order-1", sb);
    const [, , invoiceArg] = mockBuild.mock.calls[0];
    expect(invoiceArg.seller_snapshot).toEqual(frozenSnapshot);
  });

  it("AC5: invoice_number is unchanged after regeneration", async () => {
    const sb = makeSupabase();
    await regenerateInvoice("order-1", sb);
    const [, , invoiceArg] = mockBuild.mock.calls[0];
    expect(invoiceArg.invoice_number).toBe("INV-2026-00001");
  });

  it("AC5: issued_at is unchanged after regeneration", async () => {
    const sb = makeSupabase();
    await regenerateInvoice("order-1", sb);
    const [, , invoiceArg] = mockBuild.mock.calls[0];
    expect(invoiceArg.issued_at).toBe("2026-11-01T10:00:00Z");
  });

  it("EC4: regenerating after the seller name changed in settings keeps the snapshot value", async () => {
    // The test: even if business_legal_name in site_settings changed to "New Name",
    // regenerateInvoice MUST still pass the frozen snapshot to buildInvoicePdf.
    const sb = makeSupabase();
    await regenerateInvoice("order-1", sb);
    expect(mockBuild).toHaveBeenCalledOnce();
    const [, , invoiceArg] = mockBuild.mock.calls[0];
    expect(invoiceArg.seller_snapshot.name).toBe("Ceylon Safety Ltd"); // unchanged
  });

  it("returns ok:false when invoice row not found", async () => {
    const sb = makeSupabase({ invoiceRow: null, invoiceError: { message: "not found" } });
    const result = await regenerateInvoice("order-1", sb);
    expect(result.ok).toBe(false);
  });
});
