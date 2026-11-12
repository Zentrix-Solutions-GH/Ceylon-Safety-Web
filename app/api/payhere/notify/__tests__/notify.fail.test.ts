/**
 * notify.fail.test.ts — AC11: fulfil_payhere_locked throws → route returns 500
 *
 * Confirms that when fulfilNotification throws, the route:
 * 1. Returns HTTP 500 (not 200) so PayHere retries.
 * 2. Does NOT mark the payment_event as processed — leaving it for S-081 replay.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({
  payhereConfig: () => ({ merchantId: "1234567", secret: "secret" }),
}));
vi.mock("@/lib/payhere/verify", () => ({
  verifyNotifySignature: vi.fn().mockReturnValue(true),
  parseNotifyBody: vi.fn((raw: string) => {
    const p = new URLSearchParams(raw);
    return Object.fromEntries(p.entries());
  }),
}));
vi.mock("@/lib/payhere/money", () => ({
  parseCentsStrict: vi.fn().mockReturnValue(500000),
}));
vi.mock("@/lib/orders/fulfil", () => ({
  fulfilNotification: vi.fn().mockRejectedValue(new Error("RPC failed: connection reset")),
}));
vi.mock("@/lib/supabase/admin");

import { POST } from "../route";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function makeRequest() {
  const body = new URLSearchParams({
    merchant_id: "1234567",
    order_id: "ORD-001",
    payment_id: "pay-999",
    payhere_amount: "5000.00",
    payhere_currency: "LKR",
    status_code: "2",
    md5sig: "dummy",
    payment_description: "Visa",
  }).toString();
  return new NextRequest("http://localhost/api/payhere/notify", {
    method: "POST",
    body,
    headers: { "content-type": "application/x-www-form-urlencoded" },
  });
}

const ORDER = { id: "ord-uuid", user_id: "usr-1", order_number: "ORD-001", total_cents: 500000, status: "pending", expires_at: null };

describe("notify route — fulfil failure (AC11)", () => {
  let updateMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    updateMock = vi.fn().mockReturnThis();
    (createSupabaseAdminClient as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "orders") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: ORDER, error: null }),
            update: updateMock,
          };
        }
        return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: "evt-1", processed_at: null }, error: null }),
          update: updateMock,
          eq: vi.fn().mockReturnThis(),
        };
      }),
    });
  });

  it("AC11: returns 500 when fulfilNotification throws", async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toHaveProperty("error", "fulfil_error");
  });

  it("AC13: does not log the raw form body or payment_id in any log call", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    await POST(makeRequest());
    const allArgs = [
      ...errorSpy.mock.calls.flat(),
      ...warnSpy.mock.calls.flat(),
      ...infoSpy.mock.calls.flat(),
    ].map(a => (typeof a === "string" ? a : JSON.stringify(a)));
    // Raw body fields (payment_id, md5sig) must not appear in logs
    expect(allArgs.some(s => s.includes("pay-999"))).toBe(false);
    expect(allArgs.some(s => s.includes("md5sig"))).toBe(false);
    errorSpy.mockRestore();
    warnSpy.mockRestore();
    infoSpy.mockRestore();
  });

  it("AC11: does not mark payment_event processed when fulfil throws", async () => {
    await POST(makeRequest());
    // The update mock should NOT have been called with outcome or processed_at
    // (the event row is left unprocessed for S-081 replay)
    const updateCalls = updateMock.mock.calls;
    const processedAtSet = updateCalls.some(
      (args: unknown[]) =>
        typeof args[0] === "object" &&
        args[0] !== null &&
        "processed_at" in (args[0] as Record<string, unknown>) &&
        "outcome" in (args[0] as Record<string, unknown>),
    );
    expect(processedAtSet).toBe(false);
  });
});
