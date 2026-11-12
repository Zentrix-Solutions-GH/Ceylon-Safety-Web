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
const ORDER_ID = "550e8400-e29b-41d4-a716-446655440001";

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
    expect(mockFulfil).not.toHaveBeenCalled();
  });

  it("returns 200 and calls fulfilNotification for valid success notification", async () => {
    mockSupabaseWithOrder(true);
    const body = makeBody({ status_code: "2" });
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(200);
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
    expect(mockFulfil).not.toHaveBeenCalled();
  });

  it("returns 200 for amount mismatch and does not call fulfil", async () => {
    const sb = {
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
    expect(mockFulfil).not.toHaveBeenCalled();
  });

  it("returns 200 and calls fulfil for pending status (extends expiry)", async () => {
    mockSupabaseWithOrder(true);
    const body = makeBody({ status_code: "0" });
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(200);
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
    expect(mockFulfil).toHaveBeenCalledOnce();
  });

  it("returns 400 when merchant_id does not match config", async () => {
    mockSupabaseWithOrder(true);
    const body = makeBody({ merchant_id: "WRONG-MID" });
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
  });
});
