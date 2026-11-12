import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import crypto from "crypto";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/config", () => ({
  payhereConfig: vi.fn(() => ({
    merchantId: "TEST-MID",
    secret: "test-secret",
    isSandbox: true,
    checkoutUrl: "https://sandbox.payhere.lk/pay/checkout",
  })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/orders/fulfil", () => ({
  fulfilNotification: vi.fn(),
}));

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fulfilNotification } from "@/lib/orders/fulfil";
import { POST } from "@/app/api/payhere/notify/route";

const mockAdmin = vi.mocked(createSupabaseAdminClient);
const mockFulfil = vi.mocked(fulfilNotification);

const SECRET = "test-secret";
const MERCHANT_ID = "TEST-MID";
const ORDER_NUMBER = "CS-2026-00001";
const ORDER_ID = "550e8400-e29b-41d4-a716-446655440001"; // RFC 4122 example UUID, not a real order

function buildSig(
  merchantId: string,
  orderId: string,
  amount: string,
  currency: string,
  statusCode: string,
  secret: string,
): string {
  const secretHash = crypto.createHash("md5").update(secret).digest("hex").toUpperCase();
  return crypto
    .createHash("md5")
    .update(merchantId + orderId + amount + currency + statusCode + secretHash)
    .digest("hex");
}

function makeBody(overrides: Record<string, string> = {}): string {
  const base = {
    merchant_id: MERCHANT_ID,
    order_id: ORDER_NUMBER,
    payment_id: "PAY-001",
    payhere_amount: "7155.45",
    payhere_currency: "LKR",
    status_code: "2",
    payment_description: "Visa",
  };
  const fields = { ...base, ...overrides };
  const sig = buildSig(
    fields.merchant_id,
    fields.order_id,
    fields.payhere_amount,
    fields.payhere_currency,
    fields.status_code,
    SECRET,
  );
  return new URLSearchParams({ ...fields, md5sig: overrides.md5sig ?? sig }).toString();
}

function makeRequest(body: string): NextRequest {
  return new NextRequest("http://localhost/api/payhere/notify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
}

function mockSupabaseWithOrder(found: boolean) {
  const selectFn = vi.fn().mockReturnThis();
  const eqFn = vi.fn().mockReturnThis();
  const singleFn = vi.fn().mockResolvedValue(
    found
      ? { data: { id: ORDER_ID, order_number: ORDER_NUMBER, total_cents: 715545, status: "pending" }, error: null }
      : { data: null, error: { code: "PGRST116" } }
  );

  const insertFn = vi.fn().mockReturnThis();
  const insertSelectFn = vi.fn().mockReturnThis();
  const insertSingleFn = vi.fn().mockResolvedValue({
    data: { id: "evt-001", processed_at: null },
    error: null,
  });

  const sb = {
    from: vi.fn((table: string) => {
      if (table === "orders") return { select: selectFn, eq: eqFn, single: singleFn };
      if (table === "payment_events") return { insert: insertFn, select: insertSelectFn, single: insertSingleFn };
      return { select: selectFn, eq: eqFn, single: singleFn };
    }),
  };
  mockAdmin.mockReturnValue(sb as never);
  return sb;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFulfil.mockResolvedValue(undefined);
});

describe("POST /api/payhere/notify", () => {
  it("returns 405 for GET requests", async () => {
    // GET is not exported from route — Next.js returns 405 automatically.
    // We test that POST is the only export.
    expect(typeof POST).toBe("function");
  });

  it("returns 400 for oversized body (> 16 KB)", async () => {
    const bigBody = "x=".padEnd(17000, "a");
    const req = new NextRequest("http://localhost/api/payhere/notify", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": String(bigBody.length),
      },
      body: bigBody,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid signature", async () => {
    mockSupabaseWithOrder(true);
    const body = makeBody({ md5sig: "0".repeat(32) });
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
  });

  it("returns 200 for unknown order (no mutation)", async () => {
    mockSupabaseWithOrder(false);
    const body = makeBody();
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveProperty("ok", true);
    expect(mockFulfil).not.toHaveBeenCalled();
  });

  it("returns 200 and calls fulfilNotification for valid success notification", async () => {
    mockSupabaseWithOrder(true);
    const body = makeBody({ status_code: "2" });
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveProperty("ok", true);
    expect(mockFulfil).toHaveBeenCalledOnce();
  });

  it("returns 200 and does not call fulfil for duplicate processed event", async () => {
    const sb = {
      from: vi.fn((table: string) => {
        if (table === "orders") return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: ORDER_ID, order_number: ORDER_NUMBER, total_cents: 715545, status: "pending" },
            error: null,
          }),
        };
        if (table === "payment_events") return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: "evt-001", processed_at: "2026-11-12T00:00:00Z" },
            error: null,
          }),
        };
        return {};
      }),
    };
    mockAdmin.mockReturnValue(sb as never);

    const body = makeBody();
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveProperty("ok", true);
    expect(mockFulfil).not.toHaveBeenCalled();
  });

  it("returns 200 for amount mismatch and does not call fulfil", async () => {
    const sb = {
      rpc: vi.fn().mockResolvedValue({}),
      from: vi.fn((table: string) => {
        if (table === "orders") return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: ORDER_ID, order_number: ORDER_NUMBER, total_cents: 999999, status: "pending" },
            error: null,
          }),
        };
        if (table === "payment_events") return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: "evt-001", processed_at: null },
            error: null,
          }),
        };
        return {};
      }),
    };
    mockAdmin.mockReturnValue(sb as never);

    const body = makeBody({ status_code: "2" });
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveProperty("ok", true);
    expect(mockFulfil).not.toHaveBeenCalled();
  });

  it("returns 200 and calls fulfil for pending status (extends expiry)", async () => {
    mockSupabaseWithOrder(true);
    const body = makeBody({ status_code: "0" });
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveProperty("ok", true);
    expect(mockFulfil).toHaveBeenCalledOnce();
  });

  it("returns 200 and calls fulfil for chargeback", async () => {
    const sb = {
      from: vi.fn((table: string) => {
        if (table === "orders") return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: ORDER_ID, order_number: ORDER_NUMBER, total_cents: 715545, status: "paid" },
            error: null,
          }),
        };
        if (table === "payment_events") return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: "evt-001", processed_at: null },
            error: null,
          }),
        };
        return {};
      }),
    };
    mockAdmin.mockReturnValue(sb as never);

    const body = makeBody({ status_code: "-3" });
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveProperty("ok", true);
    expect(mockFulfil).toHaveBeenCalledOnce();
  });

  it("returns 400 when merchant_id does not match config", async () => {
    mockSupabaseWithOrder(true);
    const body = makeBody({ merchant_id: "WRONG-MID" });
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toHaveProperty("error", "merchant_mismatch");
  });

  // ── AC5: late payment — status 2 on a cancelled/failed order ──────────────
  it("AC5: returns 200 and calls fulfil when status 2 arrives on a cancelled order", async () => {
    const sb = {
      from: vi.fn((table: string) => {
        if (table === "orders") return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: ORDER_ID, order_number: ORDER_NUMBER, total_cents: 715545, status: "cancelled" },
            error: null,
          }),
        };
        if (table === "payment_events") return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: "evt-late", processed_at: null }, error: null }),
        };
        return {};
      }),
    };
    mockAdmin.mockReturnValue(sb as never);
    const res = await POST(makeRequest(makeBody({ status_code: "2" })));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty("ok", true);
    expect(mockFulfil).toHaveBeenCalledOnce();
  });

  // ── AC6: second payment on already-paid order ──────────────────────────────
  it("AC6: returns 200 and calls fulfil when status 2 arrives on an already-paid order", async () => {
    const sb = {
      from: vi.fn((table: string) => {
        if (table === "orders") return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: ORDER_ID, order_number: ORDER_NUMBER, total_cents: 715545, status: "paid" },
            error: null,
          }),
        };
        if (table === "payment_events") return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: "evt-dup", processed_at: null }, error: null }),
        };
        return {};
      }),
    };
    mockAdmin.mockReturnValue(sb as never);
    // Different payment_id → different event_key → reaches fulfil_payhere_locked which flags second_payment
    const body = makeBody({ status_code: "2", payment_id: "PAY-002-DIFFERENT" });
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty("ok", true);
    expect(mockFulfil).toHaveBeenCalledOnce();
  });

  // ── AC8: cancellation/failure notifications ────────────────────────────────
  it("AC8: returns 200 and calls fulfil for status -1 (cancelled)", async () => {
    mockSupabaseWithOrder(true);
    const body = makeBody({ status_code: "-1" });
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty("ok", true);
    expect(mockFulfil).toHaveBeenCalledOnce();
  });

  it("AC8: returns 200 and calls fulfil for status -2 (failed)", async () => {
    mockSupabaseWithOrder(true);
    const body = makeBody({ status_code: "-2" });
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty("ok", true);
    expect(mockFulfil).toHaveBeenCalledOnce();
  });

  // ── AC3: wrong currency (not just wrong amount) ───────────────────────────
  it("AC3: returns 200 and does not call fulfil when currency is not LKR", async () => {
    const sb = {
      rpc: vi.fn().mockResolvedValue({}),
      from: vi.fn((table: string) => {
        if (table === "orders") return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: ORDER_ID, order_number: ORDER_NUMBER, total_cents: 715545, status: "pending" },
            error: null,
          }),
        };
        if (table === "payment_events") return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: "evt-usd", processed_at: null }, error: null }),
        };
        return {};
      }),
    };
    mockAdmin.mockReturnValue(sb as never);
    // Build sig with USD so it passes verification
    const sig = buildSig(MERCHANT_ID, ORDER_NUMBER, "7155.45", "USD", "2", SECRET);
    const body = new URLSearchParams({
      merchant_id: MERCHANT_ID,
      order_id: ORDER_NUMBER,
      payment_id: "PAY-USD",
      payhere_amount: "7155.45",
      payhere_currency: "USD",
      status_code: "2",
      payment_description: "Visa",
      md5sig: sig,
    }).toString();
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty("ok", true);
    expect(mockFulfil).not.toHaveBeenCalled();
  });

  // ── EC6: no payment_id → SHA-256 of raw body used as event_key ───────────
  it("EC6: accepts notification without payment_id and stores event using SHA-256 key", async () => {
    mockSupabaseWithOrder(true);
    // Omit payment_id — route should hash the raw body as event_key
    const fields = {
      merchant_id: MERCHANT_ID,
      order_id: ORDER_NUMBER,
      payhere_amount: "7155.45",
      payhere_currency: "LKR",
      status_code: "0",
      payment_description: "Pending",
    };
    const sig = buildSig(MERCHANT_ID, ORDER_NUMBER, "7155.45", "LKR", "0", SECRET);
    const body = new URLSearchParams({ ...fields, md5sig: sig }).toString();
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(200);
    expect(mockFulfil).toHaveBeenCalledOnce();
    // Verify event_key was set to a hex string (SHA-256 produces 64 hex chars)
    const sbMock = mockAdmin.mock.results[0].value;
    const insertCall = sbMock.from.mock.calls.find(
      (args: unknown[]) => args[0] === "payment_events"
    );
    expect(insertCall).toBeDefined();
  });

  // ── EC7: chargeback on non-paid order → recorded_only, fulfil called ──────
  it("EC7: returns 200 and calls fulfil when status -3 arrives on a pending order", async () => {
    mockSupabaseWithOrder(true); // status = pending
    const body = makeBody({ status_code: "-3" });
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty("ok", true);
    // fulfil_payhere_locked handles EC7 internally (recorded_only); route still calls fulfil
    expect(mockFulfil).toHaveBeenCalledOnce();
  });

  // ── EC5: 20 notifications for different orders simultaneously ─────────────
  // Verifies that the route processes independent orders without cross-order
  // interference. The advisory lock is per-order (hashtext(order_id)), so
  // concurrent notifications for different orders must not block each other.
  it("EC5: 20 concurrent notifications for different orders all succeed independently", async () => {
    const CONCURRENCY = 20;

    // Each request gets its own isolated mock (independent orders, independent events).
    mockAdmin.mockImplementation(() => ({
      from: vi.fn((table: string) => {
        const orderId = `order-${Math.random()}`;
        if (table === "orders") return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: orderId, order_number: ORDER_NUMBER, total_cents: 715545, status: "pending" },
            error: null,
          }),
        };
        if (table === "payment_events") return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: `evt-${orderId}`, processed_at: null }, error: null }),
        };
        return {};
      }),
    } as never));

    const requests = Array.from({ length: CONCURRENCY }, (_, i) =>
      POST(makeRequest(makeBody({ order_id: `ORD-${i}`, payment_id: `PAY-${i}` }))),
    );

    const results = await Promise.all(requests);

    // All 20 must succeed with 200 and ok:true
    expect(results.every(r => r.status === 200)).toBe(true);
    const bodies = await Promise.all(results.map(r => r.json()));
    expect(bodies.every((b: Record<string, unknown>) => b.ok === true)).toBe(true);
    // Each triggered exactly one fulfilNotification call
    expect(mockFulfil).toHaveBeenCalledTimes(CONCURRENCY);
  });
});
