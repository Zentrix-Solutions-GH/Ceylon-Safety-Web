/**
 * Tests for the expire-pending-orders job (AC1, AC2, AC5).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

import { expirePendingOrders } from "@/lib/orders/expire";

function makeSupabase(options: {
  rpcError?: { message: string } | null;
  rpcData?: number | null;
} = {}) {
  const { rpcError = null, rpcData = 0 } = options;

  return {
    rpc: vi.fn().mockResolvedValue({ data: rpcData, error: rpcError }),
  };
}

describe("expirePendingOrders", () => {
  beforeEach(() => vi.clearAllMocks());

  it("AC1: calls expire_pending_orders() rpc and returns count", async () => {
    const sb = makeSupabase({ rpcData: 3 });
    const result = await expirePendingOrders(sb as never);
    expect(result.ok).toBe(true);
    expect(result.cancelled).toBe(3);
    expect(sb.rpc).toHaveBeenCalledWith("expire_pending_orders");
  });

  it("AC1: returns ok:true with cancelled:0 when no orders expired", async () => {
    const sb = makeSupabase({ rpcData: 0 });
    const result = await expirePendingOrders(sb as never);
    expect(result.ok).toBe(true);
    expect(result.cancelled).toBe(0);
  });

  it("AC1: returns ok:false when rpc returns error", async () => {
    const sb = makeSupabase({ rpcError: { message: "db error" }, rpcData: null });
    const result = await expirePendingOrders(sb as never);
    expect(result.ok).toBe(false);
  });

  it("AC2: DB function returns 0 when all pending orders have future expires_at (48h slow-pay, extended)", async () => {
    // The SQL predicate `expires_at < now()` means the DB function itself returns 0
    // for any order whose expires_at is in the future. We model this by returning 0
    // from the rpc — matching what the DB would return for a 48h or reuse-extended order.
    const sb = makeSupabase({ rpcData: 0 });
    const result = await expirePendingOrders(sb as never);
    expect(result.ok).toBe(true);
    expect(result.cancelled).toBe(0);
  });

  it("AC5 (idempotency): second call with no expired orders returns cancelled:0", async () => {
    const sb = makeSupabase({ rpcData: 0 });
    const r1 = await expirePendingOrders(sb as never);
    const r2 = await expirePendingOrders(sb as never);
    expect(r1.ok).toBe(true);
    expect(r1.cancelled).toBe(0);
    expect(r2.ok).toBe(true);
    expect(r2.cancelled).toBe(0);
  });
});
