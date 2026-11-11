// S-078: createCheckout unit tests (AC1–AC9, AC11, AC13, EC1–EC7)

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));
vi.mock("@/lib/auth/server", () => ({ requireActiveAccount: vi.fn() }));
vi.mock("@/lib/cart/calculate", () => ({ calculateCart: vi.fn() }));
vi.mock("@/lib/ratelimit", () => ({ checkRateLimit: vi.fn() }));

import { createSupabaseServerClient as _createSupabaseServerClient } from "@/lib/supabase/server";
import { requireActiveAccount } from "@/lib/auth/server";
import { calculateCart } from "@/lib/cart/calculate";
import { checkRateLimit } from "@/lib/ratelimit";
import { createCheckout } from "@/lib/orders/create";

const mockRequireActiveAccount = vi.mocked(requireActiveAccount);
const mockCreateClient = vi.mocked(_createSupabaseServerClient);
const mockCalculateCart = vi.mocked(calculateCart);
const mockCheckRateLimit = vi.mocked(checkRateLimit);

const fakeUser = { id: "user-1", email: "buyer@example.com", status: "active" };

const validBilling = {
  firstName: "Kasun",
  lastName: "Perera",
  phone: "0771234567",
  address: "No 1, Main Street",
  city: "Colombo",
};

const validInput = {
  billing: validBilling,
  expectedTotalCents: 1000,
  acceptedTerms: true,
};

const fakeCartLine = {
  cartItemId: "ci-1",
  documentId: "00000000-0000-4000-8000-000000000001",
  title: "Safety Sign Pack",
  slug: "safety-sign-pack",
  coverUrl: null,
  language: "en" as const,
  pageCount: 10,
  price: 1000,
  available: true,
};

const fakeCartResponse = {
  items: [fakeCartLine],
  subtotal: 1000,
  total: 1000,
};

function makeSupabaseMock(overrides: Record<string, unknown> = {}) {
  const chain: Record<string, unknown> = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    single: vi.fn(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    rpc: vi.fn(),
    ...overrides,
  };
  return chain;
}

beforeEach(() => vi.clearAllMocks());

// ─── AC1: auth gate ──────────────────────────────────────────────────────────

describe("createCheckout — AC1 auth gate", () => {
  it("returns not_allowed when signed out", async () => {
    mockRequireActiveAccount.mockResolvedValue({ ok: false, code: "reauth_required" } as never);
    const result = await createCheckout(validInput);
    expect(result).toMatchObject({ ok: false, code: "not_allowed" });
  });

  it("returns not_allowed when account suspended", async () => {
    mockRequireActiveAccount.mockResolvedValue({ ok: false, code: "not_allowed" } as never);
    const result = await createCheckout(validInput);
    expect(result).toMatchObject({ ok: false, code: "not_allowed" });
  });
});

// ─── AC2: rate limit ─────────────────────────────────────────────────────────

describe("createCheckout — AC2 rate limit", () => {
  it("returns rate_limited on 11th call", async () => {
    mockRequireActiveAccount.mockResolvedValue({ ok: true, user: fakeUser } as never);
    mockCheckRateLimit.mockResolvedValue({
      ok: false,
      retryAfterSeconds: 3600,
      reason: "rate_limited",
    });
    const result = await createCheckout(validInput);
    expect(result).toMatchObject({ ok: false, code: "rate_limited" });
  });
});

// ─── AC3/EC1: price verification ─────────────────────────────────────────────

describe("createCheckout — AC3/EC1 price verification", () => {
  beforeEach(() => {
    mockRequireActiveAccount.mockResolvedValue({ ok: true, user: fakeUser } as never);
    mockCheckRateLimit.mockResolvedValue({ ok: true });
  });

  it("returns price_changed when expected total differs", async () => {
    mockCalculateCart.mockResolvedValue(fakeCartResponse);
    const db = makeSupabaseMock();
    mockCreateClient.mockResolvedValue(db as never);

    const result = await createCheckout({ ...validInput, expectedTotalCents: 999, acceptedTerms: true });
    expect(result).toMatchObject({ ok: false, code: "price_changed" });
  });

  it("returns cart_empty when cart has no items", async () => {
    mockCalculateCart.mockResolvedValue({ items: [], subtotal: 0, total: 0 });
    const db = makeSupabaseMock();
    mockCreateClient.mockResolvedValue(db as never);

    const result = await createCheckout(validInput);
    expect(result).toMatchObject({ ok: false, code: "cart_empty" });
  });

  it("AC9: returns payment_unavailable when server total is zero or negative", async () => {
    // A document with price=0 (e.g. free document via coupon — Release 1 guard)
    mockCalculateCart.mockResolvedValue({
      items: [{ ...fakeCartLine, price: 0 }],
      subtotal: 0,
      total: 0,
    });
    const db = makeSupabaseMock();
    mockCreateClient.mockResolvedValue(db as never);

    const result = await createCheckout({ ...validInput, expectedTotalCents: 0 });
    expect(result).toMatchObject({ ok: false, code: "payment_unavailable" });
  });
});

// ─── AC4: unavailable items ───────────────────────────────────────────────────

describe("createCheckout — AC4 unavailable items", () => {
  beforeEach(() => {
    mockRequireActiveAccount.mockResolvedValue({ ok: true, user: fakeUser } as never);
    mockCheckRateLimit.mockResolvedValue({ ok: true });
  });

  it("returns item_unavailable for unpublished document", async () => {
    mockCalculateCart.mockResolvedValue({
      items: [{ ...fakeCartLine, available: false, price: 0, unavailableReason: "document_unavailable" as const }],
      subtotal: 0,
      total: 0,
    });
    const db = makeSupabaseMock();
    mockCreateClient.mockResolvedValue(db as never);

    const result = await createCheckout({ ...validInput, expectedTotalCents: 0 });
    expect(result).toMatchObject({ ok: false, code: "item_unavailable" });
  });

  it("returns language_unavailable for missing language file", async () => {
    mockCalculateCart.mockResolvedValue({
      items: [{ ...fakeCartLine, available: false, price: 0, unavailableReason: "language_unavailable" as const }],
      subtotal: 0,
      total: 0,
    });
    const db = makeSupabaseMock();
    mockCreateClient.mockResolvedValue(db as never);

    const result = await createCheckout({ ...validInput, expectedTotalCents: 0 });
    expect(result).toMatchObject({ ok: false, code: "language_unavailable" });
  });
});

// ─── AC7: billing validation ──────────────────────────────────────────────────

describe("createCheckout — AC7 billing validation", () => {
  beforeEach(() => {
    mockRequireActiveAccount.mockResolvedValue({ ok: true, user: fakeUser } as never);
    mockCheckRateLimit.mockResolvedValue({ ok: true });
    mockCalculateCart.mockResolvedValue(fakeCartResponse);
  });

  const missingCases: Array<[string, Partial<typeof validBilling>]> = [
    ["firstName", { firstName: "" }],
    ["lastName", { lastName: "" }],
    ["phone", { phone: "" }],
    ["address", { address: "" }],
    ["city", { city: "" }],
  ];

  for (const [field, override] of missingCases) {
    it(`returns billing_invalid for missing ${field}`, async () => {
      const db = makeSupabaseMock();
      mockCreateClient.mockResolvedValue(db as never);

      const result = await createCheckout({
        billing: { ...validBilling, ...override },
        expectedTotalCents: 1000,
        acceptedTerms: true,
      });
      expect(result).toMatchObject({ ok: false, code: "billing_invalid", field });
    });
  }

  it("accepts Sinhala script in billing fields", async () => {
    // Should not return billing_invalid — may fail for other reasons (terms etc.)
    const db = makeSupabaseMock();
    // No page_revisions — will return payment_unavailable, not billing_invalid
    (db.single as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: { code: "PGRST116" } });
    mockCreateClient.mockResolvedValue(db as never);

    const result = await createCheckout({
      billing: { ...validBilling, firstName: "කසුන්", city: "කොළඹ" },
      expectedTotalCents: 1000,
      acceptedTerms: true,
    });
    expect(result).not.toMatchObject({ ok: false, code: "billing_invalid" });
  });

  it("accepts Tamil script in billing fields", async () => {
    const db = makeSupabaseMock();
    (db.single as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: { code: "PGRST116" } });
    mockCreateClient.mockResolvedValue(db as never);

    const result = await createCheckout({
      billing: { ...validBilling, firstName: "கசுன்", city: "கொழும்பு" },
      expectedTotalCents: 1000,
      acceptedTerms: true,
    });
    expect(result).not.toMatchObject({ ok: false, code: "billing_invalid" });
  });

  it("returns terms_required when acceptedTerms is false", async () => {
    const db = makeSupabaseMock();
    mockCreateClient.mockResolvedValue(db as never);

    const result = await createCheckout({
      ...validInput,
      acceptedTerms: false,
    });
    expect(result).toMatchObject({ ok: false, code: "terms_required" });
  });
});

// ─── AC8: terms revision ──────────────────────────────────────────────────────

describe("createCheckout — AC8 terms revision", () => {
  beforeEach(() => {
    mockRequireActiveAccount.mockResolvedValue({ ok: true, user: fakeUser } as never);
    mockCheckRateLimit.mockResolvedValue({ ok: true });
    mockCalculateCart.mockResolvedValue(fakeCartResponse);
  });

  it("returns payment_unavailable when terms revision missing", async () => {
    const db = makeSupabaseMock();
    // First call (terms): missing; second call (refund): irrelevant
    (db.single as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: { code: "PGRST116" } });
    mockCreateClient.mockResolvedValue(db as never);

    const result = await createCheckout(validInput);
    expect(result).toMatchObject({ ok: false, code: "payment_unavailable" });
  });

  it("returns payment_unavailable when refund policy revision missing", async () => {
    const db = makeSupabaseMock();
    // terms: ok, refund: missing
    (db.single as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ data: { id: "rev-terms-1" }, error: null })
      .mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } });
    mockCreateClient.mockResolvedValue(db as never);

    const result = await createCheckout(validInput);
    expect(result).toMatchObject({ ok: false, code: "payment_unavailable" });
  });
});

// ─── AC9 (multi-item): all cart items flow through to the RPC ────────────────

describe("createCheckout — AC9 multi-item cart", () => {
  beforeEach(() => {
    mockRequireActiveAccount.mockResolvedValue({ ok: true, user: fakeUser } as never);
    mockCheckRateLimit.mockResolvedValue({ ok: true });
  });

  it("passes all cart items to create_order_locked with correct line totals", async () => {
    const line1 = { ...fakeCartLine, cartItemId: "ci-1", documentId: "00000000-0000-4000-8000-000000000001", title: "Safety Sign Pack", price: 400 };
    const line2 = { ...fakeCartLine, cartItemId: "ci-2", documentId: "00000000-0000-4000-8000-000000000002", title: "Toolbox Talk Vol 1", price: 300 };
    const line3 = { ...fakeCartLine, cartItemId: "ci-3", documentId: "00000000-0000-4000-8000-000000000003", title: "Fire Safety Checklist", price: 300 };
    mockCalculateCart.mockResolvedValue({ items: [line1, line2, line3], subtotal: 1000, total: 1000 });

    const db = makeSupabaseMock();
    (db.single as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ data: { id: "rev-terms-1" }, error: null })
      .mockResolvedValueOnce({ data: { id: "rev-refund-1" }, error: null });
    (db.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { action: "created", order_id: "order-uuid-1", order_number: "CS-0001" },
      error: null,
    });
    mockCreateClient.mockResolvedValue(db as never);

    const result = await createCheckout({ ...validInput, expectedTotalCents: 1000 });

    expect(result).toMatchObject({ ok: true, data: { orderNumber: "CS-0001" } });

    // Verify the RPC received all 3 items with the correct unit and line prices.
    const rpcArgs = (db.rpc as ReturnType<typeof vi.fn>).mock.calls[0] as [string, Record<string, unknown>];
    const items = rpcArgs[1].p_items as Array<Record<string, unknown>>;
    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({ document_id: line1.documentId, unit_price_cents: 400, line_total_cents: 400 });
    expect(items[1]).toMatchObject({ document_id: line2.documentId, unit_price_cents: 300, line_total_cents: 300 });
    expect(items[2]).toMatchObject({ document_id: line3.documentId, unit_price_cents: 300, line_total_cents: 300 });

    // Verify subtotal on the order payload equals sum of line totals (400+300+300=1000).
    const orderData = rpcArgs[1].p_order_data as Record<string, unknown>;
    expect(orderData.subtotal_cents).toBe(1000);
    expect(orderData.total_cents).toBe(1000);
  });
});

// ─── EC3: re-buy an already-owned document ────────────────────────────────────

describe("createCheckout — EC3 re-buy already-owned document", () => {
  it("proceeds to create a new order even if the document is already owned", async () => {
    // The TypeScript layer does not check entitlements — that is handled by the DB
    // function (which REQ-044h allows: re-purchase creates a new order).
    // This test verifies the action layer passes through to create_order_locked.
    mockRequireActiveAccount.mockResolvedValue({ ok: true, user: fakeUser } as never);
    mockCheckRateLimit.mockResolvedValue({ ok: true });
    mockCalculateCart.mockResolvedValue(fakeCartResponse);

    const db = makeSupabaseMock();
    (db.single as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ data: { id: "rev-terms-1" }, error: null })
      .mockResolvedValueOnce({ data: { id: "rev-refund-1" }, error: null });
    (db.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { action: "created", order_id: "order-uuid-2", order_number: "CS-0002" },
      error: null,
    });
    mockCreateClient.mockResolvedValue(db as never);

    const result = await createCheckout(validInput);

    // The TS action does not gate on ownership; it must reach create_order_locked.
    expect(result).toMatchObject({ ok: true, data: { orderNumber: "CS-0002" } });
    expect(db.rpc).toHaveBeenCalledWith("create_order_locked", expect.objectContaining({
      p_user_id: fakeUser.id,
    }));
  });
});

// ─── AC14: no PII in server logs ─────────────────────────────────────────────

describe("createCheckout — AC14 no PII in logs", () => {
  it("does not log billing PII fields on a successful checkout", async () => {
    mockRequireActiveAccount.mockResolvedValue({ ok: true, user: fakeUser } as never);
    mockCheckRateLimit.mockResolvedValue({ ok: true });
    mockCalculateCart.mockResolvedValue(fakeCartResponse);

    const db = makeSupabaseMock();
    (db.single as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ data: { id: "rev-terms-1" }, error: null })
      .mockResolvedValueOnce({ data: { id: "rev-refund-1" }, error: null });
    (db.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { action: "created", order_id: "order-uuid-1", order_number: "CS-0001" },
      error: null,
    });
    mockCreateClient.mockResolvedValue(db as never);

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logSpy   = vi.spyOn(console, "log").mockImplementation(() => {});

    await createCheckout({
      billing: { ...validBilling, phone: "0771234567" },
      expectedTotalCents: 1000,
      acceptedTerms: true,
    });

    const piiFields = ["phone", "billing_phone", "firstName", "lastName", "billing_name", "address", "billing_address", "email", "billing_email"];
    const allArgs = [...errorSpy.mock.calls, ...logSpy.mock.calls].map((c) => JSON.stringify(c));
    for (const field of piiFields) {
      for (const entry of allArgs) {
        expect(entry).not.toContain(field);
      }
    }

    errorSpy.mockRestore();
    logSpy.mockRestore();
  });
});

// ─── AC13: error codes exported ───────────────────────────────────────────────

describe("AC13 — COMMERCE_ERROR_CODES exported from types/api.ts", () => {
  it("contains all required codes", async () => {
    const { COMMERCE_ERROR_CODES } = await import("@/types/api");
    const required = [
      "cart_empty",
      "item_unavailable",
      "language_unavailable",
      "price_changed",
      "pending_order_exists",
      "terms_required",
      "billing_invalid",
      "payment_unavailable",
      "payment_in_progress",
    ];
    for (const code of required) {
      expect(COMMERCE_ERROR_CODES).toContain(code);
    }
  });
});
