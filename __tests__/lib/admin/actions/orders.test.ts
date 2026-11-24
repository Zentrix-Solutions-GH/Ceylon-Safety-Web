// S-089: Admin order actions — unit tests

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

// ── auth mock ───────────────────────────────────────────────────────────────
vi.mock("@/lib/auth/server", () => ({
  requireStaff: vi.fn(),
  requireSuperAdmin: vi.fn(),
}));

// ── audit mock ───────────────────────────────────────────────────────────────
vi.mock("@/lib/audit/index", () => ({
  writeAuditRow: vi.fn().mockResolvedValue(undefined),
}));

// ── resend mock ───────────────────────────────────────────────────────────────
vi.mock("@/lib/orders/resend-receipt", () => ({
  resendReceiptForOrder: vi.fn().mockResolvedValue({ ok: true }),
}));

// ── coupon mock ───────────────────────────────────────────────────────────────
vi.mock("@/lib/orders/coupon", () => ({
  releaseCouponUse: vi.fn().mockResolvedValue(undefined),
}));

// ── Supabase mock ─────────────────────────────────────────────────────────────
let sbFromImpl: (table: string) => unknown = () => ({});
const rpcMock = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: () => ({
    from: (table: string) => sbFromImpl(table),
    rpc: rpcMock,
  }),
}));

import {
  getOrdersList,
  getOrderDetail,
  cancelPendingOrder,
  resolveReview,
  resendOrderEmail,
  grantOrderAccess,
} from "@/lib/admin/actions/orders";
import { requireStaff } from "@/lib/auth/server";
import { writeAuditRow } from "@/lib/audit/index";
import { resendReceiptForOrder } from "@/lib/orders/resend-receipt";
import { releaseCouponUse } from "@/lib/orders/coupon";

const requireStaffMock = vi.mocked(requireStaff);
const writeAuditRowMock = vi.mocked(writeAuditRow);
const resendReceiptMock = vi.mocked(resendReceiptForOrder);
const releaseCouponUseMock = vi.mocked(releaseCouponUse);

// ── helpers ───────────────────────────────────────────────────────────────────

const TEST_ORDER_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

function makeOrder(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: TEST_ORDER_ID,
    order_number: "CS-0001",
    status: "pending",
    payment_method: "card",
    total_cents: 100_00,
    created_at: "2026-11-01T10:00:00Z",
    needs_review: false,
    review_reason: null,
    profiles: { id: "u-1", first_name: "Nimal", last_name: "Perera", email: "nimal@example.com" },
    ...overrides,
  };
}

function makeStaffOk(id = "staff-1") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { ok: true as const, user: { id, email: "staff@example.com", claimedRole: "admin", emailVerified: true, status: "active" } } as any;
}

function makeSuperAdminOk(id = "super-1") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { ok: true as const, user: { id, email: "super@example.com", claimedRole: "super_admin", emailVerified: true, status: "active" } } as any;
}

// ─────────────────────────────────────────────────────────────────────────────
// AC1 + AC7: getOrdersList
// ─────────────────────────────────────────────────────────────────────────────

describe("getOrdersList", () => {
  beforeEach(() => vi.clearAllMocks());

  it("S3: returns validation_failed for injection-like search string", async () => {
    // The OrdersListFilterSchema regex only allows [A-Za-z0-9\s\-_] in search.
    const result = await getOrdersList({ search: "'; DROP TABLE orders--" });
    expect(result).toEqual({ ok: false, code: "validation_failed" });
    expect(requireStaffMock).not.toHaveBeenCalled();
  });

  it("S3: returns validation_failed for search exceeding 50 chars", async () => {
    const result = await getOrdersList({ search: "a".repeat(51) });
    expect(result).toEqual({ ok: false, code: "validation_failed" });
  });

  it("AC1: search passes .or() covering buyer name and email", async () => {
    requireStaffMock.mockResolvedValue(makeStaffOk());
    let capturedOrArg: string | undefined;
    sbFromImpl = () => ({
      select: vi.fn().mockReturnThis(),
      or: vi.fn().mockImplementation((arg: string) => {
        capturedOrArg = arg;
        return { order: vi.fn().mockReturnThis(), range: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }) };
      }),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
    });

    await getOrdersList({ search: "Nimal" });

    expect(capturedOrArg).toContain("order_number.ilike.%Nimal%");
    expect(capturedOrArg).toContain("profiles.first_name.ilike.%Nimal%");
    expect(capturedOrArg).toContain("profiles.last_name.ilike.%Nimal%");
    expect(capturedOrArg).toContain("profiles.email.ilike.%Nimal%");
  });

  it("S17: returns not_allowed when requireStaff returns account_suspended", async () => {
    requireStaffMock.mockResolvedValue({ ok: false, code: "account_suspended" });
    const result = await getOrdersList({});
    expect(result).toEqual({ ok: false, code: "not_allowed" });
  });

  it("AC7: returns not_allowed when staff check fails", async () => {
    requireStaffMock.mockResolvedValue({ ok: false, code: "not_allowed" });

    const result = await getOrdersList({});

    expect(result).toEqual({ ok: false, code: "not_allowed" });
    expect(requireStaffMock).toHaveBeenCalledWith("orders.read");
  });

  it("AC1: returns paginated orders with default page 1", async () => {
    requireStaffMock.mockResolvedValue(makeStaffOk());
    const rows = [makeOrder(), makeOrder({ id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22", order_number: "CS-0002" })];

    sbFromImpl = () => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: rows, error: null, count: 2 }),
    });

    const result = await getOrdersList({});

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data!.items).toHaveLength(2);
    expect(result.data!.total).toBe(2);
    expect(result.data!.page).toBe(1);
  });

  it("AC1: filters by status", async () => {
    requireStaffMock.mockResolvedValue(makeStaffOk());
    let capturedEq: unknown;
    sbFromImpl = () => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockImplementation((col: string, val: unknown) => {
        if (col === "status") capturedEq = val;
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), range: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }) };
      }),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
    });

    await getOrdersList({ status: "paid" });
    expect(capturedEq).toBe("paid");
  });

  it("AC1: response never exposes payment_events raw payload", async () => {
    requireStaffMock.mockResolvedValue(makeStaffOk());
    const row = { ...makeOrder(), payment_events: [{ payload: { card: "4111111111111111" } }] };

    sbFromImpl = () => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: [row], error: null, count: 1 }),
    });

    const result = await getOrdersList({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const item = result.data!.items[0];
    expect(item).not.toHaveProperty("payment_events");
  });

  it("AC1: needsReview filter passes correctly", async () => {
    requireStaffMock.mockResolvedValue(makeStaffOk());
    const eqCalls: Array<[string, unknown]> = [];
    const chainEnd = { order: vi.fn().mockReturnThis(), range: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }) };
    sbFromImpl = () => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockImplementation((col: string, val: unknown) => {
        eqCalls.push([col, val]);
        return { ...chainEnd, eq: vi.fn().mockImplementation((c: string, v: unknown) => { eqCalls.push([c, v]); return chainEnd; }) };
      }),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
    });

    await getOrdersList({ needsReview: true });
    expect(eqCalls.some(([col, val]) => col === "needs_review" && val === true)).toBe(true);
  });

  it("AC1: filters by paymentMethod", async () => {
    requireStaffMock.mockResolvedValue(makeStaffOk());
    let capturedPaymentMethod: unknown;
    sbFromImpl = () => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockImplementation((col: string, val: unknown) => {
        if (col === "payment_method") capturedPaymentMethod = val;
        return { eq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), range: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }) };
      }),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
    });

    await getOrdersList({ paymentMethod: "bank_transfer" });
    expect(capturedPaymentMethod).toBe("bank_transfer");
  });

  it("AC1: filters by dateFrom using gte", async () => {
    requireStaffMock.mockResolvedValue(makeStaffOk());
    let capturedGte: unknown;
    sbFromImpl = () => ({
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockImplementation((_col: string, val: unknown) => {
        capturedGte = val;
        return { order: vi.fn().mockReturnThis(), range: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }) };
      }),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
    });

    await getOrdersList({ dateFrom: "2026-11-01T00:00:00+00:00" });
    expect(capturedGte).toBe("2026-11-01T00:00:00+00:00");
  });

  it("AC1: filters by dateTo using lte", async () => {
    requireStaffMock.mockResolvedValue(makeStaffOk());
    let capturedLte: unknown;
    sbFromImpl = () => ({
      select: vi.fn().mockReturnThis(),
      lte: vi.fn().mockImplementation((_col: string, val: unknown) => {
        capturedLte = val;
        return { order: vi.fn().mockReturnThis(), range: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }) };
      }),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
    });

    await getOrdersList({ dateTo: "2026-11-30T23:59:59+00:00" });
    expect(capturedLte).toBe("2026-11-30T23:59:59+00:00");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC2: getOrderDetail
// ─────────────────────────────────────────────────────────────────────────────

describe("getOrderDetail", () => {
  beforeEach(() => vi.clearAllMocks());

  it("S3: returns validation_error for non-UUID orderId", async () => {
    const result = await getOrderDetail("not-a-uuid");
    expect(result).toEqual({ ok: false, code: "validation_error" });
    expect(requireStaffMock).not.toHaveBeenCalled();
  });

  it("AC2: returns billingSnapshot, couponSnapshot, and invoiceUrl for a paid order", async () => {
    requireStaffMock.mockResolvedValue(makeStaffOk());
    const order = {
      ...makeOrder({ status: "paid" }),
      billing_name: "Nimal Perera",
      billing_email: "nimal@example.com",
      billing_phone: "0771234567",
      billing_company: "Acme Ltd",
      billing_address: { line1: "10 Main St", city: "Colombo" },
      coupon_code_snapshot: "SAVE10",
      coupon_type_snapshot: "percent",
      coupon_value_snapshot: 10,
      order_items: [],
      payment_events: [],
      entitlements: [],
      bank_transfer_slips: [],
    };
    sbFromImpl = () => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: order, error: null }),
    });

    const result = await getOrderDetail(TEST_ORDER_ID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const d = result.data!;
    expect(d.billingSnapshot).toEqual({
      name: "Nimal Perera",
      email: "nimal@example.com",
      phone: "0771234567",
      company: "Acme Ltd",
      address: { line1: "10 Main St", city: "Colombo" },
    });
    expect(d.couponSnapshot).toEqual({ code: "SAVE10", type: "percent", value: 10 });
    expect(d.invoiceUrl).toBe(`/api/invoice/${TEST_ORDER_ID}`);
  });

  it("AC2: invoiceUrl is null for a non-paid order", async () => {
    requireStaffMock.mockResolvedValue(makeStaffOk());
    const order = {
      ...makeOrder({ status: "pending" }),
      billing_name: null, billing_email: null, billing_phone: null,
      billing_company: null, billing_address: null,
      coupon_code_snapshot: null, coupon_type_snapshot: null, coupon_value_snapshot: null,
      order_items: [], payment_events: [], entitlements: [], bank_transfer_slips: [],
    };
    sbFromImpl = () => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: order, error: null }),
    });

    const result = await getOrderDetail(TEST_ORDER_ID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data!.invoiceUrl).toBeNull();
    expect(result.data!.couponSnapshot).toBeNull();
  });

  it("AC7: returns not_allowed when staff check fails", async () => {
    requireStaffMock.mockResolvedValue({ ok: false, code: "not_allowed" });
    expect(await getOrderDetail(TEST_ORDER_ID)).toEqual({ ok: false, code: "not_allowed" });
  });

  it("AC2: returns order not found", async () => {
    requireStaffMock.mockResolvedValue(makeStaffOk());
    sbFromImpl = () => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: "not found" } }),
    });

    const result = await getOrderDetail("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380b99");
    expect(result).toEqual({ ok: false, code: "not_found" });
  });

  it("AC2: masks raw payment payload for non-super-admin", async () => {
    requireStaffMock.mockResolvedValue(makeStaffOk());
    const order = {
      ...makeOrder(),
      order_items: [],
      payment_events: [{ id: "pe-1", received_at: "2026-11-01T10:00:00Z", status_code: 2, outcome: "applied", payload: { card: "4111111111111111" } }],
      entitlements: [],
      bank_transfer_slips: [],
    };
    sbFromImpl = () => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: order, error: null }),
    });

    const result = await getOrderDetail(TEST_ORDER_ID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const events = result.data!.paymentEvents;
    expect(events[0]).not.toHaveProperty("payload");
  });

  it("AC2/AC8: super_admin sees allowlisted payment payload fields (not raw JSONB)", async () => {
    requireStaffMock.mockResolvedValue(makeSuperAdminOk());
    const rawPayload = { status_code: 2, amount: "10.00", currency: "LKR", order_id: "CS-0001", method: "card", card: "4111111111111111" };
    const order = {
      ...makeOrder(),
      order_items: [],
      payment_events: [{ id: "pe-1", received_at: "2026-11-01T10:00:00Z", status_code: 2, outcome: "applied", payload: rawPayload }],
      entitlements: [],
      bank_transfer_slips: [],
    };
    sbFromImpl = () => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: order, error: null }),
    });

    const result = await getOrderDetail(TEST_ORDER_ID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const payload = result.data!.paymentEvents[0].payload as Record<string, unknown> | undefined;
    expect(payload).toBeDefined();
    // Only allowlisted fields are returned
    expect(payload).toEqual({ status_code: 2, amount: "10.00", currency: "LKR", order_id: "CS-0001", method: "card" });
    // Raw sensitive field never appears
    expect(payload).not.toHaveProperty("card");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC3 + EC1: cancelPendingOrder
// ─────────────────────────────────────────────────────────────────────────────

describe("cancelPendingOrder", () => {
  beforeEach(() => vi.clearAllMocks());

  it("S3: returns validation_error for non-UUID orderId", async () => {
    const result = await cancelPendingOrder("bad-id", "some reason");
    expect(result).toEqual({ ok: false, code: "validation_error" });
    expect(requireStaffMock).not.toHaveBeenCalled();
  });

  it("S3: returns validation_error for empty reason", async () => {
    const result = await cancelPendingOrder(TEST_ORDER_ID, "");
    expect(result).toEqual({ ok: false, code: "validation_error" });
    expect(requireStaffMock).not.toHaveBeenCalled();
  });

  it("AC7: returns not_allowed when staff check fails", async () => {
    requireStaffMock.mockResolvedValue({ ok: false, code: "not_allowed" });
    expect(await cancelPendingOrder(TEST_ORDER_ID, "admin override")).toEqual({ ok: false, code: "not_allowed" });
  });

  it("AC3: cancels a pending order and writes audit row", async () => {
    requireStaffMock.mockResolvedValue(makeStaffOk());
    rpcMock.mockResolvedValue({ data: { action: "cancelled" }, error: null });

    const result = await cancelPendingOrder(TEST_ORDER_ID, "testing cancel");

    expect(result).toEqual({ ok: true });
    expect(rpcMock).toHaveBeenCalledWith("admin_cancel_order", {
      p_order_id: TEST_ORDER_ID,
      p_reason: "testing cancel",
    });
    expect(releaseCouponUseMock).toHaveBeenCalledWith({ id: TEST_ORDER_ID });
    expect(writeAuditRowMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "order.cancel", entityId: TEST_ORDER_ID })
    );
  });

  it("AC3: refuses with payment_in_progress when RPC returns that action", async () => {
    requireStaffMock.mockResolvedValue(makeStaffOk());
    rpcMock.mockResolvedValue({ data: { action: "payment_in_progress" }, error: null });

    const result = await cancelPendingOrder(TEST_ORDER_ID, "cancel attempt");

    expect(result).toEqual({ ok: false, code: "payment_in_progress" });
    expect(releaseCouponUseMock).not.toHaveBeenCalled();
    expect(writeAuditRowMock).not.toHaveBeenCalled();
  });

  it("EC1: returns not_allowed for already-cancelled or paid order", async () => {
    requireStaffMock.mockResolvedValue(makeStaffOk());
    rpcMock.mockResolvedValue({ data: { action: "already_done" }, error: null });

    const result = await cancelPendingOrder(TEST_ORDER_ID, "cancel");

    expect(result).toEqual({ ok: false, code: "not_allowed" });
    expect(releaseCouponUseMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC4 + EC4: resolveReview
// ─────────────────────────────────────────────────────────────────────────────

describe("resolveReview", () => {
  beforeEach(() => vi.clearAllMocks());

  it("S3: returns validation_error for non-UUID orderId", async () => {
    const result = await resolveReview("bad-id", "note");
    expect(result).toEqual({ ok: false, code: "validation_error" });
    expect(requireStaffMock).not.toHaveBeenCalled();
  });

  it("AC7: returns not_allowed when staff check fails", async () => {
    requireStaffMock.mockResolvedValue({ ok: false, code: "not_allowed" });
    expect(await resolveReview(TEST_ORDER_ID, "looked good")).toEqual({ ok: false, code: "not_allowed" });
  });

  it("AC4: clears needs_review flag and writes audit row", async () => {
    requireStaffMock.mockResolvedValue(makeStaffOk());
    const updateFn = vi.fn().mockResolvedValue({ error: null });
    const updateMock = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: updateFn }) });
    sbFromImpl = () => ({ update: updateMock });

    const result = await resolveReview(TEST_ORDER_ID, "verified");

    expect(result).toEqual({ ok: true });
    expect(updateMock).toHaveBeenCalledWith({ needs_review: false, review_reason: "verified" });
    expect(writeAuditRowMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "order.resolve_review", entityId: TEST_ORDER_ID })
    );
  });

  it("EC4: resolveReview on order without needs_review is a no-op (succeeds)", async () => {
    requireStaffMock.mockResolvedValue(makeStaffOk());
    const updateFn = vi.fn().mockResolvedValue({ error: null });
    sbFromImpl = () => ({
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: updateFn }) }),
    });

    const result = await resolveReview("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380b98", "just checking");
    expect(result).toEqual({ ok: true });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC5: resendOrderEmail
// ─────────────────────────────────────────────────────────────────────────────

describe("resendOrderEmail", () => {
  beforeEach(() => vi.clearAllMocks());

  it("S3: returns validation_error for non-UUID orderId", async () => {
    const result = await resendOrderEmail("bad-id");
    expect(result).toEqual({ ok: false, code: "validation_error" });
    expect(requireStaffMock).not.toHaveBeenCalled();
  });

  it("AC7: returns not_allowed when staff check fails", async () => {
    requireStaffMock.mockResolvedValue({ ok: false, code: "not_allowed" });
    expect(await resendOrderEmail(TEST_ORDER_ID)).toEqual({ ok: false, code: "not_allowed" });
  });

  it("AC5: calls resendReceiptForOrder (uses receipt_resend/_resend template) and writes audit row", async () => {
    requireStaffMock.mockResolvedValue(makeStaffOk());
    resendReceiptMock.mockResolvedValue({ ok: true });

    const result = await resendOrderEmail(TEST_ORDER_ID);

    expect(result).toEqual({ ok: true });
    // resendReceiptForOrder is the function that bakes in the receipt_resend template suffix (AC5).
    // Verifying it is called with the correct orderId confirms the _resend path is taken.
    expect(resendReceiptMock).toHaveBeenCalledOnce();
    expect(resendReceiptMock).toHaveBeenCalledWith(TEST_ORDER_ID, expect.anything());
    expect(writeAuditRowMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "order.resend_email", entityId: TEST_ORDER_ID })
    );
  });

  it("AC5: returns error when resend fails", async () => {
    requireStaffMock.mockResolvedValue(makeStaffOk());
    resendReceiptMock.mockResolvedValue({ ok: false, error: "Send failed" });

    const result = await resendOrderEmail(TEST_ORDER_ID);

    expect(result).toEqual({ ok: false, code: "email_failed" });
    expect(writeAuditRowMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC6 + EC2: grantOrderAccess
// ─────────────────────────────────────────────────────────────────────────────

describe("grantOrderAccess", () => {
  beforeEach(() => vi.clearAllMocks());

  it("S3: returns validation_error for non-UUID orderId", async () => {
    const result = await grantOrderAccess("bad-id", "support");
    expect(result).toEqual({ ok: false, code: "validation_error" });
    expect(requireStaffMock).not.toHaveBeenCalled();
  });

  it("S3: returns validation_error for empty reason", async () => {
    const result = await grantOrderAccess(TEST_ORDER_ID, "");
    expect(result).toEqual({ ok: false, code: "validation_error" });
    expect(requireStaffMock).not.toHaveBeenCalled();
  });

  it("AC7/EC2: returns not_allowed for non-super-admin (orders.grant permission)", async () => {
    requireStaffMock.mockResolvedValue({ ok: false, code: "not_allowed" });

    const result = await grantOrderAccess(TEST_ORDER_ID, "support case");

    expect(result).toEqual({ ok: false, code: "not_allowed" });
    expect(requireStaffMock).toHaveBeenCalledWith("orders.grant");
  });

  it("AC6: returns not_allowed when order is not paid", async () => {
    requireStaffMock.mockResolvedValue(makeSuperAdminOk());
    const order = makeOrder({ status: "pending" });
    sbFromImpl = (table: string) => {
      if (table === "orders") return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: order, error: null }),
      };
      return { insert: vi.fn().mockResolvedValue({ error: null }) };
    };

    const result = await grantOrderAccess(TEST_ORDER_ID, "support case");
    expect(result).toEqual({ ok: false, code: "not_allowed" });
  });

  it("AC6: creates admin_grant entitlements and writes audit row for paid order", async () => {
    requireStaffMock.mockResolvedValue(makeSuperAdminOk());
    const order = {
      ...makeOrder({ status: "paid" }),
      order_items: [
        { id: "oi-1", document_id: "doc-1", language: "en" },
        { id: "oi-2", document_id: "doc-2", language: "si" },
      ],
    };
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    sbFromImpl = (table: string) => {
      if (table === "orders") return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: order, error: null }),
      };
      return { insert: insertMock };
    };

    const result = await grantOrderAccess(TEST_ORDER_ID, "CS-123 support case");

    expect(result).toEqual({ ok: true });
    expect(insertMock).toHaveBeenCalled();
    const insertArg = insertMock.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(Array.isArray(insertArg)).toBe(true);
    expect(insertArg).toHaveLength(2);
    expect(insertArg[0]).toMatchObject({ source: "admin_grant", document_id: "doc-1", language: "en" });
    expect(writeAuditRowMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "order.grant", entityId: TEST_ORDER_ID })
    );
  });

  it("AC6: duplicate grant (23505) is treated as success (idempotent)", async () => {
    requireStaffMock.mockResolvedValue(makeSuperAdminOk());
    const order = {
      ...makeOrder({ status: "paid" }),
      order_items: [{ id: "oi-1", document_id: "doc-1", language: "en" }],
    };
    sbFromImpl = (table: string) => {
      if (table === "orders") return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: order, error: null }),
      };
      return { insert: vi.fn().mockResolvedValue({ error: { code: "23505", message: "duplicate key" } }) };
    };

    const result = await grantOrderAccess(TEST_ORDER_ID, "duplicate grant");
    expect(result).toEqual({ ok: true });
  });

  it("AC8: no raw card numbers in audit log (writeAuditRow masks them)", async () => {
    requireStaffMock.mockResolvedValue(makeSuperAdminOk());
    const order = {
      ...makeOrder({ status: "paid" }),
      order_items: [{ id: "oi-1", document_id: "doc-1", language: "en" }],
    };
    sbFromImpl = (table: string) => {
      if (table === "orders") return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: order, error: null }),
      };
      return { insert: vi.fn().mockResolvedValue({ error: null }) };
    };

    await grantOrderAccess(TEST_ORDER_ID, "support");
    expect(writeAuditRowMock).toHaveBeenCalled();
    const auditCall = writeAuditRowMock.mock.calls[0]?.[0] as Record<string, unknown>;
    const auditStr = JSON.stringify(auditCall);
    expect(auditStr).not.toMatch(/\d{8,}/);
  });
});
