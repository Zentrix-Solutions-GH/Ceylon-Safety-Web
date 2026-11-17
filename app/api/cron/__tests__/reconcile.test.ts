/**
 * Tests for the reconcile-payments job (AC3, AC5).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

import { reconcileCardPayments, getPendingCardOrdersOlderThan } from "@/lib/orders/reconcile";

function makeOrder(overrides: Partial<{
  id: string;
  order_number: string;
  created_at: string;
  status: string;
  payment_method: string;
  expires_at: string | null;
}> = {}) {
  return {
    id: "order-1",
    order_number: "CS-0001",
    created_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(), // 20 min ago
    status: "pending",
    payment_method: "card",
    expires_at: new Date(Date.now() + 100 * 60 * 1000).toISOString(), // future
    ...overrides,
  };
}

function makeSupabase(options: {
  pendingOrders?: ReturnType<typeof makeOrder>[];
  queryError?: { message: string } | null;
} = {}) {
  const { pendingOrders = [], queryError = null } = options;

  const ordersUpdateSpy = vi.fn();
  const ordersChain = {
    eq: vi.fn(),
    lt: vi.fn(),
    update: ordersUpdateSpy,
  };
  ordersChain.eq.mockReturnThis();
  ordersChain.lt.mockResolvedValue({ data: pendingOrders, error: queryError });

  const eventsChain = {
    eq: vi.fn(),
    in: vi.fn().mockResolvedValue({ data: [], error: null }),
  };
  eventsChain.eq.mockReturnThis();

  const sb = {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "orders") {
        return { select: vi.fn().mockReturnValue(ordersChain), update: ordersUpdateSpy };
      }
      if (table === "payment_events") {
        return { select: vi.fn().mockReturnValue(eventsChain) };
      }
      return {};
    }),
    _ordersUpdateSpy: ordersUpdateSpy,
    _ordersEqSpy: ordersChain.eq,
  };
  return sb;
}

describe("reconcileCardPayments", () => {
  beforeEach(() => vi.clearAllMocks());

  it("AC3: returns ok:true with alertCount when pending orders found", async () => {
    const order = makeOrder();
    const sb = makeSupabase({ pendingOrders: [order] });
    const result = await reconcileCardPayments(sb as never);
    expect(result.ok).toBe(true);
    expect(result.alertCount).toBe(1);
    expect(result.orderNumbers).toContain("CS-0001");
  });

  it("AC3: returns ok:true with alertCount:0 when no pending orders", async () => {
    const sb = makeSupabase({ pendingOrders: [] });
    const result = await reconcileCardPayments(sb as never);
    expect(result.ok).toBe(true);
    expect(result.alertCount).toBe(0);
  });

  it("AC3: never marks an order paid — only logs/alerts", async () => {
    const order = makeOrder();
    const sb = makeSupabase({ pendingOrders: [order] });
    await reconcileCardPayments(sb as never);
    // The orders table's update() must never be called — reconcile only reads and logs.
    expect(sb._ordersUpdateSpy).not.toHaveBeenCalled();
  });

  it("AC3: returns ok:false when query fails", async () => {
    const sb = makeSupabase({ queryError: { message: "db error" } });
    const result = await reconcileCardPayments(sb as never);
    expect(result.ok).toBe(false);
  });

  it("AC5 (idempotency): second run with same orders returns same alertCount", async () => {
    const order = makeOrder();
    const sb = makeSupabase({ pendingOrders: [order] });
    const r1 = await reconcileCardPayments(sb as never);
    const r2 = await reconcileCardPayments(sb as never);
    expect(r1.alertCount).toBe(r2.alertCount);
  });
});

describe("getPendingCardOrdersOlderThan", () => {
  beforeEach(() => vi.clearAllMocks());

  it("AC4: returns pending card orders older than the given minutes", async () => {
    const order = makeOrder();
    const sb = makeSupabase({ pendingOrders: [order] });
    const orders = await getPendingCardOrdersOlderThan(15, sb as never);
    expect(orders).toHaveLength(1);
    expect(orders[0].order_number).toBe("CS-0001");
  });

  it("AC4: returns empty array when no orders match", async () => {
    const sb = makeSupabase({ pendingOrders: [] });
    const orders = await getPendingCardOrdersOlderThan(15, sb as never);
    expect(orders).toHaveLength(0);
  });

  it("AC4: payment_method=card filter is applied — bank-transfer orders excluded", async () => {
    const sb = makeSupabase({ pendingOrders: [] });
    await getPendingCardOrdersOlderThan(120, sb as never);
    // The orders chain .eq must be called with "payment_method", "card"
    expect(sb._ordersEqSpy).toHaveBeenCalledWith("payment_method", "card");
  });
});
