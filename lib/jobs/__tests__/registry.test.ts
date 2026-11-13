/**
 * AC8: JOB_REGISTRY content guard.
 * replay-payment-events must be registered; finalize-paid-orders must NOT
 * be registered until S-086/S-087 merge.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({
  serverConfig: { cronSecret: "test-secret" },
  healthchecksConfig: vi.fn().mockReturnValue(null),
}));
vi.mock("@/lib/orders/fulfil", () => ({ fulfilNotification: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }));

describe("JOB_REGISTRY", () => {
  it("AC8: contains replay-payment-events", async () => {
    const { JOB_REGISTRY } = await import("@/lib/jobs");
    expect(JOB_REGISTRY).toHaveProperty("replay-payment-events");
  });

  it("AC8: does NOT contain finalize-paid-orders (added only with S-086/S-087)", async () => {
    const { JOB_REGISTRY } = await import("@/lib/jobs");
    expect(JOB_REGISTRY).not.toHaveProperty("finalize-paid-orders");
  });
});
