import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/orders/coupon", () => ({
  releaseCouponUse: vi.fn().mockResolvedValue(undefined),
}));

import { fulfilNotification, type FulfilInput } from "../fulfil";
import { releaseCouponUse } from "@/lib/orders/coupon";

type SB = SupabaseClient<Database>;

function makeSb(rpcResult: { data: unknown; error: { message: string } | null }) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { value: 3 }, error: null }),
    }),
    rpc: vi.fn().mockResolvedValue(rpcResult),
  } as unknown as SB;
}

const BASE_EVENT: FulfilInput = {
  eventId: "evt-1",
  statusCode: 2,
  paymentId: "pay-1",
  paymentDescription: "Visa",
  amountCents: 500000,
  currency: "LKR",
};

const ORDER_ID = "order-uuid-1";

describe("fulfilNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls rpc with correct params", async () => {
    const sb = makeSb({ data: { outcome: "applied", is_late: false }, error: null });
    await fulfilNotification(ORDER_ID, BASE_EVENT, sb);
    expect((sb as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc).toHaveBeenCalledWith(
      "fulfil_payhere_locked",
      expect.objectContaining({
        p_order_id: ORDER_ID,
        p_event_id: "evt-1",
        p_status_code: 2,
        p_payment_desc: "Visa",
      }),
    );
  });

  it("throws when rpc returns error", async () => {
    const sb = makeSb({ data: null, error: { message: "db error" } });
    await expect(fulfilNotification(ORDER_ID, BASE_EVENT, sb)).rejects.toThrow("RPC failed");
  });

  it("logs console.error for late payment (is_late=true)", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const sb = makeSb({ data: { outcome: "applied", is_late: true }, error: null });
    await fulfilNotification(ORDER_ID, BASE_EVENT, sb);
    expect(spy).toHaveBeenCalledWith("payhere_fulfil: late_payment_applied", expect.any(Object));
    spy.mockRestore();
  });

  it("does not log for on-time payment (is_late=false)", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const sb = makeSb({ data: { outcome: "applied", is_late: false }, error: null });
    await fulfilNotification(ORDER_ID, BASE_EVENT, sb);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("logs console.error for second_payment_flagged", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const sb = makeSb({ data: { outcome: "second_payment_flagged" }, error: null });
    await fulfilNotification(ORDER_ID, BASE_EVENT, sb);
    expect(spy).toHaveBeenCalledWith("payhere_fulfil: second_payment_flagged", expect.any(Object));
    spy.mockRestore();
  });

  it("logs console.error for chargeback_applied", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const sb = makeSb({ data: { outcome: "chargeback_applied" }, error: null });
    await fulfilNotification(ORDER_ID, BASE_EVENT, sb);
    expect(spy).toHaveBeenCalledWith("payhere_fulfil: chargeback_applied", expect.any(Object));
    spy.mockRestore();
  });

  it("logs console.error for recorded_only on unknown status code", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const sb = makeSb({ data: { outcome: "recorded_only" }, error: null });
    await fulfilNotification(ORDER_ID, { ...BASE_EVENT, statusCode: 99 }, sb);
    expect(spy).toHaveBeenCalledWith("payhere_fulfil: unknown_status_recorded", expect.any(Object));
    spy.mockRestore();
  });

  it("does not log for recorded_only on status 0 (pending)", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const sb = makeSb({ data: { outcome: "recorded_only" }, error: null });
    await fulfilNotification(ORDER_ID, { ...BASE_EVENT, statusCode: 0 }, sb);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("calls releaseCouponUse when outcome is payment_cancelled", async () => {
    const sb = makeSb({ data: { outcome: "payment_cancelled" }, error: null });
    await fulfilNotification(ORDER_ID, { ...BASE_EVENT, statusCode: -1 }, sb);
    expect(releaseCouponUse).toHaveBeenCalledWith({ id: ORDER_ID });
  });

  it("calls releaseCouponUse when outcome is payment_failed", async () => {
    const sb = makeSb({ data: { outcome: "payment_failed" }, error: null });
    await fulfilNotification(ORDER_ID, { ...BASE_EVENT, statusCode: -2 }, sb);
    expect(releaseCouponUse).toHaveBeenCalledWith({ id: ORDER_ID });
  });

  it("does not call releaseCouponUse for outcome applied", async () => {
    const sb = makeSb({ data: { outcome: "applied", is_late: false }, error: null });
    await fulfilNotification(ORDER_ID, BASE_EVENT, sb);
    expect(releaseCouponUse).not.toHaveBeenCalled();
  });
});
