// S-084: approval transaction and double-approval idempotency — AC6, AC7, EC7

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({
  serverConfig: { supabaseServiceRoleKey: "srk" },
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
  createSupabaseServiceRoleClient: vi.fn(),
}));
vi.mock("@/lib/auth/server", () => ({ requireStaff: vi.fn() }));
vi.mock("@/lib/auth/step-up", () => ({ requireStepUp: vi.fn(), _resetCacheForTest: vi.fn() }));
vi.mock("@/lib/ratelimit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/bank/review", () => ({
  isSelfApproval: vi.fn(),
  fetchApprovalDownloadLimit: vi.fn(),
}));

import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/server";
import { requireStepUp, _resetCacheForTest } from "@/lib/auth/step-up";
import { checkRateLimit } from "@/lib/ratelimit";
import { isSelfApproval } from "@/lib/bank/review";
import { approveBankOrder } from "@/lib/admin/actions/bank-transfers";

const ORDER_ID = "00000000-0000-4000-8000-000000000001";
const SLIP_ID  = "00000000-0000-4000-8000-000000000011";
const BUYER_ID = "user-buyer-1";
const STAFF_ID = "staff-01";

const STAFF = {
  id: STAFF_ID,
  email: "staff@example.com",
  phone: null,
  claimedRole: "admin" as const,
  hasTotpEnrolled: true,
  hasAuthenticatorLevel: true,
};

function makeDb(rpcOutcome: string, rpcError: unknown = null) {
  const order = {
    id: ORDER_ID, user_id: BUYER_ID,
    status: "pending_verification",
    total_cents: 100_000,
    payment_provider: "bank_transfer",
  };
  const slip = {
    id: SLIP_ID, order_id: ORDER_ID,
    status: "uploaded",
    file_key: "slips/test.jpg",
    first_reviewed_by: null,
  };
  return {
    from: vi.fn((table: string) => {
      if (table === "orders") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: order, error: null }),
        };
      }
      if (table === "bank_transfer_slips") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: slip, error: null }),
        };
      }
      return {};
    }),
    rpc: vi.fn().mockResolvedValue({ data: { outcome: rpcOutcome }, error: rpcError }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  _resetCacheForTest();
  vi.mocked(requireStaff).mockResolvedValue({ ok: true, user: STAFF } as never);
  vi.mocked(requireStepUp).mockResolvedValue(undefined);
  vi.mocked(checkRateLimit).mockResolvedValue({ ok: true } as never);
  vi.mocked(isSelfApproval).mockReturnValue(false);
});

// ─── AC6: approval returns applied ───────────────────────────────────────────

describe("approveBankOrder — AC6: final approval", () => {
  it("calls approve_bank_transfer_locked and returns applied", async () => {
    const db = makeDb("applied");
    vi.mocked(createSupabaseServerClient).mockResolvedValue(db as never);
    vi.mocked(createSupabaseServiceRoleClient).mockResolvedValue(db as never);

    const result = await approveBankOrder(ORDER_ID, SLIP_ID, "123456");
    expect(result).toMatchObject({ ok: true, data: { outcome: "applied" } });
    expect(db.rpc).toHaveBeenCalledWith(
      "approve_bank_transfer_locked",
      expect.objectContaining({
        p_order_id: ORDER_ID,
        p_slip_id:  SLIP_ID,
        p_actor_id: STAFF_ID,
      })
    );
  });

  it("passes threshold of 2,500,000 cents to the SQL function", async () => {
    const db = makeDb("applied");
    vi.mocked(createSupabaseServerClient).mockResolvedValue(db as never);
    vi.mocked(createSupabaseServiceRoleClient).mockResolvedValue(db as never);

    await approveBankOrder(ORDER_ID, SLIP_ID, "123456");
    expect(db.rpc).toHaveBeenCalledWith(
      "approve_bank_transfer_locked",
      expect.objectContaining({ p_threshold_cents: 2_500_000 })
    );
  });

  it("returns unknown when RPC errors", async () => {
    const db = makeDb("applied", { message: "db error" });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(db as never);
    vi.mocked(createSupabaseServiceRoleClient).mockResolvedValue(db as never);

    const result = await approveBankOrder(ORDER_ID, SLIP_ID, "123456");
    expect(result).toMatchObject({ ok: false, code: "unknown" });
  });
});

// ─── AC7 / EC7: double approval ───────────────────────────────────────────────

describe("approveBankOrder — AC7/EC7: double approval idempotency", () => {
  it("returns validation_failed with already_done when RPC returns already_done", async () => {
    const db = makeDb("already_done");
    vi.mocked(createSupabaseServerClient).mockResolvedValue(db as never);
    vi.mocked(createSupabaseServiceRoleClient).mockResolvedValue(db as never);

    const result = await approveBankOrder(ORDER_ID, SLIP_ID, "123456");
    expect(result).toMatchObject({ ok: false, code: "validation_failed", reason: "already_done" });
  });
});
