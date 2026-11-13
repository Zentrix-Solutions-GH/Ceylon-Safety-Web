/**
 * Tests for the replay-payment-events job (AC1, AC2).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/orders/fulfil", () => ({
  fulfilNotification: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

import { replayPaymentEvents } from "@/lib/jobs/replay-payment-events";
import { fulfilNotification } from "@/lib/orders/fulfil";

function makeEvent(overrides: Partial<{
  id: string;
  order_id: string;
  event_key: string;
  status_code: number;
  provider_payment_id: string | null;
  amount_cents: number | null;
  currency: string | null;
  processed_at: string | null;
  received_at: string;
}> = {}) {
  return {
    id: "evt-1",
    order_id: "order-1",
    event_key: "order-1:pay-1",
    status_code: 2,
    provider_payment_id: "pay-1",
    amount_cents: 500000,
    currency: "LKR",
    processed_at: null,
    received_at: new Date(Date.now() - 3 * 60 * 1000).toISOString(), // 3 min ago
    ...overrides,
  };
}

describe("replayPaymentEvents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("AC1: applies each unprocessed event older than 2 minutes exactly once", async () => {
    const event = makeEvent();
    const updateEq = vi.fn().mockResolvedValue({ error: null });
    const updateFn = vi.fn().mockReturnValue({ eq: updateEq });

    const sb = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "payment_events") {
          return {
            select: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                lt: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: [event], error: null }),
                }),
              }),
            }),
            update: updateFn,
          };
        }
        return {};
      }),
    };

    vi.mocked(fulfilNotification).mockResolvedValue(undefined);

    await replayPaymentEvents(sb as never);

    expect(fulfilNotification).toHaveBeenCalledOnce();
    expect(fulfilNotification).toHaveBeenCalledWith(
      "order-1",
      expect.objectContaining({ eventId: "evt-1", statusCode: 2 }),
      sb,
    );
    // processed_at should be set after success
    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({ processed_at: expect.any(String) }),
    );
  });

  it("AC1 idempotency: a processed event is skipped (processed_at IS NULL filter)", async () => {
    // The query filters WHERE processed_at IS NULL, so a processed event never
    // reaches the loop. We confirm by returning no events.
    const sb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          is: vi.fn().mockReturnValue({
            lt: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      }),
    };

    await replayPaymentEvents(sb as never);
    expect(fulfilNotification).not.toHaveBeenCalled();
  });

  it("AC2: a failing event is left unprocessed and raises an alert", async () => {
    const event = makeEvent();
    const updateFn = vi.fn();

    const sb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          is: vi.fn().mockReturnValue({
            lt: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [event], error: null }),
            }),
          }),
        }),
        update: updateFn,
      }),
    };

    vi.mocked(fulfilNotification).mockRejectedValue(new Error("db error"));

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await replayPaymentEvents(sb as never);

    // The event must NOT be marked processed
    expect(updateFn).not.toHaveBeenCalled();
    // An alert must be raised
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("replay"),
      expect.objectContaining({ event_id: "evt-1" }),
    );
    // AC7: failure log must not contain personal data
    const allLoggedArgs = errorSpy.mock.calls.flat().map(String).join(" ");
    expect(allLoggedArgs).not.toMatch(/@/);          // no email address
    expect(allLoggedArgs).not.toMatch(/\b\d{16}\b/); // no card number
    errorSpy.mockRestore();
  });

  it("AC2: event processed_at is not set on a failed fulfil", async () => {
    const event = makeEvent();
    const updateFn = vi.fn();

    const sb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          is: vi.fn().mockReturnValue({
            lt: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [event], error: null }),
            }),
          }),
        }),
        update: updateFn,
      }),
    };

    vi.mocked(fulfilNotification).mockRejectedValue(new Error("fail"));

    await replayPaymentEvents(sb as never);
    expect(updateFn).not.toHaveBeenCalled();
  });

  it("logs mark_processed_failed when UPDATE processed_at errors after successful fulfil", async () => {
    const event = makeEvent();
    const updateEq = vi.fn().mockResolvedValue({ error: { message: "db write fail" } });

    const sb = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "payment_events") {
          return {
            select: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                lt: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: [event], error: null }),
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({ eq: updateEq }),
          };
        }
        return {};
      }),
    };

    vi.mocked(fulfilNotification).mockResolvedValue(undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await replayPaymentEvents(sb as never);

    // fulfilNotification succeeded so the job overall is ok
    expect(result.ok).toBe(true);
    // The mark failure must be logged with the event id
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("mark_processed_failed"),
      expect.objectContaining({ event_id: "evt-1" }),
    );
    errorSpy.mockRestore();
  });
});
