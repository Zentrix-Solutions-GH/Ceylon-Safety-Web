// S-084: second approval (AC5, EC6)

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

const ORDER_ID  = "00000000-0000-4000-8000-000000000001";
const SLIP_ID   = "00000000-0000-4000-8000-000000000011";
const STAFF1_ID = "staff-01";
const STAFF2_ID = "staff-02";
const BUYER_ID  = "user-buyer-1";

const STAFF1 = {
  id: STAFF1_ID,
  email: "staff1@example.com",
  phone: null,
  claimedRole: "admin" as const,
  hasTotpEnrolled: true,
  hasAuthenticatorLevel: true,
};
const STAFF2 = { ...STAFF1, id: STAFF2_ID, email: "staff2@example.com" };

function makeDb(options: {
  totalCents?: number;
  slipStatus?: string;
  firstReviewedBy?: string | null;
  rpcOutcome?: string;
  rpcError?: unknown;
} = {}) {
  const {
    totalCents = 3_000_000, // LKR 30,000 — needs 2 approvals
    slipStatus = "uploaded",
    firstReviewedBy = null,
    rpcOutcome = "first_approved",
    rpcError = null,
  } = options;

  const order = {
    id: ORDER_ID, user_id: BUYER_ID,
    status: "pending_verification",
    total_cents: totalCents,
    payment_provider: "bank_transfer",
  };
  const slip = {
    id: SLIP_ID, order_id: ORDER_ID,
    status: slipStatus,
    file_key: "slips/test.jpg",
    first_reviewed_by: firstReviewedBy,
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
  vi.mocked(requireStepUp).mockResolvedValue(undefined);
  vi.mocked(checkRateLimit).mockResolvedValue({ ok: true } as never);
  vi.mocked(isSelfApproval).mockReturnValue(false);
});

// ─── AC5: first approval on large order ───────────────────────────────────────

describe("approveBankOrder — AC5: first approval (large order)", () => {
  it("returns first_approved for a >25,000 LKR order", async () => {
    vi.mocked(requireStaff).mockResolvedValue({ ok: true, user: STAFF1 } as never);
    const db = makeDb({ totalCents: 3_000_000, rpcOutcome: "first_approved" });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(db as never);
    vi.mocked(createSupabaseServiceRoleClient).mockResolvedValue(db as never);

    const result = await approveBankOrder(ORDER_ID, SLIP_ID, "123456");
    expect(result).toMatchObject({ ok: true, data: { outcome: "first_approved" } });
  });

  it("EC6: exactly 25,000 LKR (2,500,000 cents) needs only one approval", async () => {
    vi.mocked(requireStaff).mockResolvedValue({ ok: true, user: STAFF1 } as never);
    const db = makeDb({ totalCents: 2_500_000, rpcOutcome: "applied" });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(db as never);
    vi.mocked(createSupabaseServiceRoleClient).mockResolvedValue(db as never);

    const result = await approveBankOrder(ORDER_ID, SLIP_ID, "123456");
    expect(result).toMatchObject({ ok: true, data: { outcome: "applied" } });
  });

  it("EC6: 25,000.01 LKR (2,500,001 cents) needs two approvals", async () => {
    vi.mocked(requireStaff).mockResolvedValue({ ok: true, user: STAFF1 } as never);
    const db = makeDb({ totalCents: 2_500_001, rpcOutcome: "first_approved" });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(db as never);
    vi.mocked(createSupabaseServiceRoleClient).mockResolvedValue(db as never);

    const result = await approveBankOrder(ORDER_ID, SLIP_ID, "123456");
    expect(result).toMatchObject({ ok: true, data: { outcome: "first_approved" } });
  });
});

// ─── AC5: same-account second approval blocked ────────────────────────────────

describe("approveBankOrder — AC5: same-account second approval refused", () => {
  it("returns not_allowed when same staff gives second approval", async () => {
    vi.mocked(requireStaff).mockResolvedValue({ ok: true, user: STAFF1 } as never);
    const db = makeDb({
      totalCents: 3_000_000,
      slipStatus: "awaiting_second_approval",
      firstReviewedBy: STAFF1_ID,
      rpcOutcome: "self_second_approval",
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(db as never);
    vi.mocked(createSupabaseServiceRoleClient).mockResolvedValue(db as never);

    const result = await approveBankOrder(ORDER_ID, SLIP_ID, "123456");
    expect(result).toMatchObject({ ok: false, code: "not_allowed" });
  });

  it("allows second approval by a different staff account", async () => {
    vi.mocked(requireStaff).mockResolvedValue({ ok: true, user: STAFF2 } as never);
    const db = makeDb({
      totalCents: 3_000_000,
      slipStatus: "awaiting_second_approval",
      firstReviewedBy: STAFF1_ID,
      rpcOutcome: "applied",
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(db as never);
    vi.mocked(createSupabaseServiceRoleClient).mockResolvedValue(db as never);

    const result = await approveBankOrder(ORDER_ID, SLIP_ID, "123456");
    expect(result).toMatchObject({ ok: true, data: { outcome: "applied" } });
  });
});
