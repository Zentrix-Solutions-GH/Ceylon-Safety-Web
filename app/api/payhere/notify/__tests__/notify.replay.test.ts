/**
 * notify.replay.test.ts — AC2 / AC10 duplicate-event handling
 *
 * Verifies that the route is idempotent: a repeated notification for the same
 * payment_id:status_code returns 200 without calling fulfilNotification a
 * second time.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({
  payhereConfig: () => ({ merchantId: "1234567", secret: "secret" }),
}));
vi.mock("@/lib/orders/fulfil", () => ({
  fulfilNotification: vi.fn().mockResolvedValue(undefined),
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
vi.mock("@/lib/supabase/admin");

import { POST } from "../route";
import { fulfilNotification } from "@/lib/orders/fulfil";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function makeRequest() {
  const body = new URLSearchParams({
    merchant_id: "1234567",
    order_id: "ORD-001",
    payment_id: "pay-123",
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

/** Build a Supabase admin client mock where the first payment_events insert
 *  errors with a duplicate-key code, and the subsequent select for the existing
 *  event returns `existingRow`. */
function makeDuplicateSb(existingRow: { id: string; processed_at: string | null }) {
  let paymentEventsCallCount = 0;
  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "orders") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: ORDER, error: null }),
        };
      }
      // payment_events: first call = insert (returns dup key error);
      // second call = select to find existing row.
      paymentEventsCallCount++;
      if (paymentEventsCallCount === 1) {
        return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: { code: "23505", message: "duplicate key" } }),
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: existingRow, error: null }),
        update: vi.fn().mockReturnThis(),
      };
    }),
  };
}

describe("notify route — replay / duplicate handling (AC2, AC10)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("AC2: event already processed at insert time — returns 200, fulfil not called", async () => {
    (createSupabaseAdminClient as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "orders") {
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: ORDER, error: null }) };
        }
        return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          // processed_at already set → route returns early
          single: vi.fn().mockResolvedValue({ data: { id: "evt-1", processed_at: new Date().toISOString() }, error: null }),
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
        };
      }),
    });

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveProperty("ok", true);
    expect(fulfilNotification).not.toHaveBeenCalled();
  });

  it("AC2: duplicate key on insert, existing event already processed — returns 200, fulfil not called", async () => {
    (createSupabaseAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(
      makeDuplicateSb({ id: "evt-existing", processed_at: new Date().toISOString() }),
    );

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveProperty("ok", true);
    expect(fulfilNotification).not.toHaveBeenCalled();
  });

  it("AC2: duplicate key on insert, existing event unprocessed — continues to fulfil", async () => {
    (createSupabaseAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(
      makeDuplicateSb({ id: "evt-existing", processed_at: null }),
    );

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveProperty("ok", true);
    expect(fulfilNotification).toHaveBeenCalledOnce();
  });
});
