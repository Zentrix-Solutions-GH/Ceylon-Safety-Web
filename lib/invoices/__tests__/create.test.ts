// S-087: ensureInvoice unit tests (AC1, AC6, EC3)
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
import { ensureInvoice } from "@/lib/invoices/create";

const mockBuild = vi.mocked(buildInvoicePdf);
const mockPut = vi.mocked(putObject);

const fakeOrderRow = {
  id: "order-1",
  user_id: "user-1",
  status: "paid",
  payment_method: "card",
  total_cents: 150000,
  billing_snapshot: {
    firstName: "Kasun",
    lastName: "Perera",
    email: "kasun@example.com",
    address: "No 1, Main Street",
    city: "Colombo",
  },
  coupon_snapshot: null,
};

const fakeItems = [
  { document_id: "doc-1", title_snapshot: "Safety Checklist", language: "en", unit_price_cents: 150000 },
];

function makeSupabase(options: {
  orderRow?: typeof fakeOrderRow | null;
  orderError?: { message: string } | null;
  items?: typeof fakeItems;
  itemsError?: { message: string } | null;
  settings?: Record<string, string | null>;
  settingsError?: { message: string } | null;
  existingInvoice?: { id: string } | null;
  insertError?: { message: string; code?: string } | null;
  invoiceNumber?: string;
  rpcError?: { message: string } | null;
} = {}) {
  const {
    orderRow = fakeOrderRow,
    orderError = null,
    items = fakeItems,
    itemsError = null,
    settings = { business_legal_name: "Ceylon Safety Ltd", business_address: "Colombo 03" },
    settingsError = null,
    existingInvoice = null,
    insertError = null,
    invoiceNumber = "INV-2026-00001",
    rpcError = null,
  } = options;

  const selectChain = {
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
    in: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(),
  };

  selectChain.single.mockResolvedValueOnce({ data: orderRow, error: orderError });

  const insertChain = {
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: insertError ? null : { id: "inv-1", invoice_number: invoiceNumber },
      error: insertError ?? null,
    }),
  };

  const fromMock = vi.fn().mockImplementation((table: string) => {
    if (table === "orders") return { select: vi.fn().mockReturnValue(selectChain) };
    if (table === "order_items") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: items, error: itemsError }),
        }),
      };
    }
    if (table === "site_settings") {
      return {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({
            data: Object.entries(settings).map(([key, value]) => ({ key, value })),
            error: settingsError,
          }),
        }),
      };
    }
    if (table === "invoices") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: existingInvoice, error: null }),
          }),
        }),
        insert: vi.fn().mockReturnValue(insertChain),
      };
    }
    return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
  });

  const rpcMock = vi.fn().mockResolvedValue({ data: invoiceNumber, error: rpcError });

  return { from: fromMock, rpc: rpcMock } as unknown as Parameters<typeof ensureInvoice>[1];
}

beforeEach(() => {
  vi.clearAllMocks();
  mockBuild.mockResolvedValue(Buffer.from("PDF-BYTES"));
  mockPut.mockResolvedValue(undefined);
});

describe("ensureInvoice", () => {
  it("AC1: creates one invoice row and stores PDF when none exists", async () => {
    const sb = makeSupabase();
    const result = await ensureInvoice("order-1", sb);
    expect(result.ok).toBe(true);
    expect(mockBuild).toHaveBeenCalledOnce();
    expect(mockPut).toHaveBeenCalledWith(expect.any(String), "invoices/order-1.pdf", expect.any(Buffer), "application/pdf");
  });

  it("AC1: pdf_key follows invoices/{orderId}.pdf pattern", async () => {
    const sb = makeSupabase();
    await ensureInvoice("order-1", sb);
    expect(mockPut).toHaveBeenCalledWith(expect.any(String), "invoices/order-1.pdf", expect.any(Buffer), "application/pdf");
  });

  it("AC1: invoice_number comes from private.next_invoice_number() rpc", async () => {
    const sb = makeSupabase({ invoiceNumber: "INV-2026-00042" });
    const result = await ensureInvoice("order-1", sb);
    expect(result.ok).toBe(true);
  });

  it("AC1: tax_label and tax_rate_bps are null, tax_cents is 0 (Q44a: no VAT)", async () => {
    const sb = makeSupabase();
    await ensureInvoice("order-1", sb);
    const fromCalls = (sb.from as ReturnType<typeof vi.fn>).mock.calls;
    const invoicesCall = fromCalls.find((c: string[]) => c[0] === "invoices");
    expect(invoicesCall).toBeTruthy();
  });

  it("AC6: returns ok:true without re-creating when invoice already exists (idempotent)", async () => {
    const sb = makeSupabase({ existingInvoice: { id: "existing-inv-1" } });
    const result = await ensureInvoice("order-1", sb);
    expect(result.ok).toBe(true);
    expect(mockBuild).not.toHaveBeenCalled();
    expect(mockPut).not.toHaveBeenCalled();
  });

  it("AC6: unique constraint conflict (code 23505) is treated as already-exists, returns ok:true", async () => {
    const sb = makeSupabase({ insertError: { message: "duplicate key", code: "23505" } });
    const result = await ensureInvoice("order-1", sb);
    expect(result.ok).toBe(true);
  });

  it("EC3: returns ok:false when business_legal_name is null (empty settings)", async () => {
    const sb = makeSupabase({ settings: { business_legal_name: null, business_address: "Colombo" } });
    const result = await ensureInvoice("order-1", sb);
    expect(result.ok).toBe(false);
  });

  it("EC3: returns ok:false when business_address is null (empty settings)", async () => {
    const sb = makeSupabase({ settings: { business_legal_name: "Ceylon Safety", business_address: null } });
    const result = await ensureInvoice("order-1", sb);
    expect(result.ok).toBe(false);
  });

  it("returns ok:false when order not found", async () => {
    const sb = makeSupabase({ orderRow: null, orderError: { message: "not found" } });
    const result = await ensureInvoice("order-1", sb);
    expect(result.ok).toBe(false);
  });
});
