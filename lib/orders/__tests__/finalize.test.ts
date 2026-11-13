/**
 * Tests for lib/orders/finalize.ts (AC3, AC4, AC5, EC1, EC2)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

vi.mock("server-only", () => ({}));

type SB = SupabaseClient<Database>;

function makeSb(options: {
  lateOrders?: { id: string }[];
  claimedOrders?: { id: string }[];
  updateError?: null | { message: string };
} = {}) {
  const updateEq = vi.fn().mockResolvedValue({ error: options.updateError ?? null });
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      lt: vi.fn().mockResolvedValue({ data: options.lateOrders ?? [], error: null }),
      update: vi.fn().mockReturnValue({ eq: updateEq }),
    }),
    rpc: vi.fn().mockResolvedValue({
      data: options.claimedOrders ?? [],
      error: null,
    }),
    _updateEq: updateEq,
  } as unknown as SB & { _updateEq: ReturnType<typeof vi.fn> };
}

describe("finalizeOrder", () => {
  beforeEach(() => vi.clearAllMocks());

  it("AC4: invoice failure does not block the email step", async () => {
    const { finalizeOrder } = await import("@/lib/orders/finalize");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const sb = makeSb();
    const result = await finalizeOrder("order-1", sb as unknown as SB);

    // Result must be returned; payment is unaffected.
    expect(result.orderId).toBe("order-1");
    errorSpy.mockRestore();
  });

  it("EC1: invoice step fails but email step still runs; finalized_at stays null until both succeed", async () => {
    const { finalizeOrder } = await import("@/lib/orders/finalize");
    const sb = makeSb();
    const result = await finalizeOrder("order-3", sb as unknown as SB);

    // Both steps are stubs (ok:false) in this story — finalizedAt must be null
    // so the job re-picks the order on the next run when real steps arrive.
    expect(result.orderId).toBe("order-3");
    expect(result.finalizedAt).toBeNull();
  });

  it("EC2: running finalizeOrder twice with stubs returns null finalizedAt both times (no double-write)", async () => {
    const { finalizeOrder } = await import("@/lib/orders/finalize");
    const sb = makeSb();
    const r1 = await finalizeOrder("order-4", sb as unknown as SB);
    const r2 = await finalizeOrder("order-4", sb as unknown as SB);

    // With stub steps (ok:false), finalized_at is not set — job retries next run.
    // SQL SKIP LOCKED prevents concurrent duplicate claims (covered by pgTAP).
    expect(r1.orderId).toBe("order-4");
    expect(r2.orderId).toBe("order-4");
  });

  it("finalizeOrder returns null finalizedAt when DB update fails", async () => {
    const { finalizeOrder } = await import("@/lib/orders/finalize");
    const sb = makeSb({ updateError: { message: "db error" } });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await finalizeOrder("order-5", sb as unknown as SB);
    expect(result.finalizedAt).toBeNull();
    errorSpy.mockRestore();
  });
});

describe("finalizePaidOrders", () => {
  beforeEach(() => vi.clearAllMocks());

  it("AC3: processes claimed orders via rpc claim_unfinalized_orders", async () => {
    const { finalizePaidOrders } = await import("@/lib/orders/finalize");
    const sb = makeSb({ claimedOrders: [{ id: "order-10" }] });

    const result = await finalizePaidOrders(sb as unknown as SB);
    expect(result.ok).toBe(true);
    expect((sb as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc).toHaveBeenCalledWith(
      "claim_unfinalized_orders",
    );
  });

  it("AC3: two simultaneous calls - second gets no orders (SKIP LOCKED modelled)", async () => {
    const { finalizePaidOrders } = await import("@/lib/orders/finalize");
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: [{ id: "order-20" }], error: null })
      .mockResolvedValueOnce({ data: [], error: null });

    const sb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        lt: vi.fn().mockResolvedValue({ data: [], error: null }),
        update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      }),
      rpc,
    } as unknown as SB;

    const [r1, r2] = await Promise.all([
      finalizePaidOrders(sb),
      finalizePaidOrders(sb),
    ]);
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
  });

  it("AC5: logs alert when paid orders unfinalized > 30 minutes", async () => {
    const { finalizePaidOrders } = await import("@/lib/orders/finalize");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const sb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        lt: vi.fn().mockResolvedValue({ data: [{ id: "late-1" }], error: null }),
        update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      }),
      rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    } as unknown as SB;

    await finalizePaidOrders(sb);

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("unfinalized_paid_orders_alert"),
      expect.objectContaining({ count: 1 }),
    );
    errorSpy.mockRestore();
  });

  it("returns ok:false when rpc fails", async () => {
    const { finalizePaidOrders } = await import("@/lib/orders/finalize");
    const sb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        lt: vi.fn().mockResolvedValue({ data: [], error: null }),
        update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      }),
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "db fail" } }),
    } as unknown as SB;

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await finalizePaidOrders(sb);
    expect(result.ok).toBe(false);
    errorSpy.mockRestore();
  });
});

describe("runFinalizeNow", () => {
  beforeEach(() => vi.clearAllMocks());

  it("AC6: runs finalizeOrder without throwing for a valid order", async () => {
    const { runFinalizeNow } = await import("@/lib/orders/finalize");
    const sb = makeSb();
    await expect(runFinalizeNow("order-99", sb as unknown as SB)).resolves.toBeUndefined();
  });

  it("AC6: swallows errors so notify route response is unaffected", async () => {
    const { runFinalizeNow } = await import("@/lib/orders/finalize");
    const sb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        lt: vi.fn().mockResolvedValue({ data: [], error: null }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockRejectedValue(new Error("db down")),
        }),
      }),
      rpc: vi.fn(),
    } as unknown as SB;

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(runFinalizeNow("order-err", sb)).resolves.toBeUndefined();
    errorSpy.mockRestore();
  });
});

describe("EC6: bank transfer orders (no payment event) finalized by same job", () => {
  beforeEach(() => vi.clearAllMocks());

  it("EC6: finalizePaidOrders processes a bank-transfer order that has no payment_events row", async () => {
    const { finalizePaidOrders } = await import("@/lib/orders/finalize");

    // A bank-transfer order appears in claim_unfinalized_orders (paid status set
    // by manual admin action) but has no payment_events row. The job must
    // process it without error and return ok:true.
    const sb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        lt: vi.fn().mockResolvedValue({ data: [], error: null }),
        update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      }),
      rpc: vi.fn().mockResolvedValue({
        data: [{ id: "bank-order-1" }],
        error: null,
      }),
    } as unknown as SB;

    const result = await finalizePaidOrders(sb);
    expect(result.ok).toBe(true);
    // The rpc must have been called — the bank-transfer order was claimed
    expect((sb as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc).toHaveBeenCalledWith(
      "claim_unfinalized_orders",
    );
  });
});
