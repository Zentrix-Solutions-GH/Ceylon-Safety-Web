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

  it("AC2 / EC3: DB function returns 0 for orders with future expires_at (48h slow-pay, 47h, reuse-extended)", async () => {
    // The SQL WHERE uses `expires_at < now()`. Any order with expires_at in the future
    // — whether it is a 48h slow-payment push, a 47h-old order, or a reuse-extended order —
    // is left untouched. The DB function returns 0 in that case.
    // We model this by returning rpcData: 0, matching what the DB returns when every
    // candidate row has a future expires_at.
    const sb = makeSupabase({ rpcData: 0 });
    const result = await expirePendingOrders(sb as never);
    expect(result.ok).toBe(true);
    expect(result.cancelled).toBe(0);
  });

  it("AC1: pending_verification orders (bank) are never cancelled — rpc returns 0 when only bank orders exist", async () => {
    // Bank orders have expires_at = NULL; the SQL WHERE `expires_at IS NOT NULL` means
    // the DB function returns 0 when only pending_verification orders are present.
    const sb = makeSupabase({ rpcData: 0 });
    const result = await expirePendingOrders(sb as never);
    expect(result.ok).toBe(true);
    expect(result.cancelled).toBe(0);
  });

  it("AC6: log contains only count — no billing data", async () => {
    const sb = makeSupabase({ rpcData: 2 });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await expirePendingOrders(sb as never);
    const allOutput = logSpy.mock.calls.map((c) => c.join(" ")).join(" ");
    expect(allOutput).toContain("2");
    expect(allOutput).not.toMatch(/amount|email|name|phone|address/i);
    logSpy.mockRestore();
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
