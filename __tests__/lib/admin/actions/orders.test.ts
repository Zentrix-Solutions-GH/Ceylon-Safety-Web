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

const requireStaffMock = vi.mocked(requireStaff);
const writeAuditRowMock = vi.mocked(writeAuditRow);
const resendReceiptMock = vi.mocked(resendReceiptForOrder);

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
});

// ─────────────────────────────────────────────────────────────────────────────
// AC2: getOrderDetail
// ─────────────────────────────────────────────────────────────────────────────

describe("getOrderDetail", () => {
  beforeEach(() => vi.clearAllMocks());

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

  it("AC2: super_admin sees raw payment payload", async () => {
    requireStaffMock.mockResolvedValue(makeSuperAdminOk());
    const rawPayload = { card: "4111111111111111" };
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
    expect(result.data!.paymentEvents[0].payload).toEqual(rawPayload);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC3 + EC1: cancelPendingOrder
// ─────────────────────────────────────────────────────────────────────────────

describe("cancelPendingOrder", () => {
  beforeEach(() => vi.clearAllMocks());

  it("AC7: returns not_allowed when staff check fails", async () => {
    requireStaffMock.mockResolvedValue({ ok: false, code: "not_allowed" });
    expect(await cancelPendingOrder(TEST_ORDER_ID, "admin override")).toEqual({ ok: false, code: "not_allowed" });
  });

  it("AC3: cancels a pending order and writes audit row", async () => {
    requireStaffMock.mockResolvedValue(makeStaffOk());
    rpcMock.mockResolvedValue({ data: { action: "cancelled" }, error: null });

    const result = await cancelPendingOrder(TEST_ORDER_ID, "testing cancel");

    expect(result).toEqual({ ok: true });
    expect(writeAuditRowMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "order.cancel", entityId: TEST_ORDER_ID })
    );
  });

  it("AC3: refuses with payment_in_progress when RPC returns that action", async () => {
    requireStaffMock.mockResolvedValue(makeStaffOk());
    rpcMock.mockResolvedValue({ data: { action: "payment_in_progress" }, error: null });

    const result = await cancelPendingOrder(TEST_ORDER_ID, "cancel attempt");

    expect(result).toEqual({ ok: false, code: "payment_in_progress" });
    expect(writeAuditRowMock).not.toHaveBeenCalled();
  });

  it("EC1: returns not_allowed for already-cancelled or paid order", async () => {
    requireStaffMock.mockResolvedValue(makeStaffOk());
    rpcMock.mockResolvedValue({ data: { action: "already_done" }, error: null });

    const result = await cancelPendingOrder(TEST_ORDER_ID, "cancel");

    expect(result).toEqual({ ok: false, code: "not_allowed" });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC4 + EC4: resolveReview
// ─────────────────────────────────────────────────────────────────────────────

describe("resolveReview", () => {
  beforeEach(() => vi.clearAllMocks());

  it("AC7: returns not_allowed when staff check fails", async () => {
    requireStaffMock.mockResolvedValue({ ok: false, code: "not_allowed" });
    expect(await resolveReview(TEST_ORDER_ID, "looked good")).toEqual({ ok: false, code: "not_allowed" });
  });

  it("AC4: clears needs_review flag and writes audit row", async () => {
    requireStaffMock.mockResolvedValue(makeStaffOk());
    const updateFn = vi.fn().mockResolvedValue({ error: null });
    sbFromImpl = () => ({
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: updateFn }) }),
    });

    const result = await resolveReview(TEST_ORDER_ID, "verified");

    expect(result).toEqual({ ok: true });
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

  it("AC7: returns not_allowed when staff check fails", async () => {
    requireStaffMock.mockResolvedValue({ ok: false, code: "not_allowed" });
    expect(await resendOrderEmail(TEST_ORDER_ID)).toEqual({ ok: false, code: "not_allowed" });
  });

  it("AC5: calls resendReceiptForOrder and writes audit row", async () => {
    requireStaffMock.mockResolvedValue(makeStaffOk());
    resendReceiptMock.mockResolvedValue({ ok: true });

    const result = await resendOrderEmail(TEST_ORDER_ID);

    expect(result).toEqual({ ok: true });
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
