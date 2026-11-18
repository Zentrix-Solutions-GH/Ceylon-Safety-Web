// S-084: self-approval checks — AC4

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
  phone: "+94771234567",
  claimedRole: "admin" as const,
  hasTotpEnrolled: true,
  hasAuthenticatorLevel: true,
};

function makeDb(overrides: {
  order?: unknown;
  slip?: unknown;
  rpcResult?: unknown;
} = {}) {
  const order = overrides.order ?? {
    id: ORDER_ID,
    user_id: BUYER_ID,
    status: "pending_verification",
    total_cents: 100000,
    payment_provider: "bank_transfer",
  };
  const slip = overrides.slip ?? {
    id: SLIP_ID,
    order_id: ORDER_ID,
    status: "uploaded",
    file_key: "slips/test.jpg",
    first_reviewed_by: null,
  };
  const rpc = overrides.rpcResult ?? { data: { outcome: "applied" }, error: null };

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
    rpc: vi.fn().mockResolvedValue(rpc),
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

// ─── AC4: self-approval blocked ───────────────────────────────────────────────

describe("approveBankOrder — AC4: self-approval blocked", () => {
  it("refuses when isSelfApproval returns true (own userId)", async () => {
    vi.mocked(isSelfApproval).mockReturnValue(true);
    const db = makeDb();
    vi.mocked(createSupabaseServerClient).mockResolvedValue(db as never);
    vi.mocked(createSupabaseServiceRoleClient).mockResolvedValue(db as never);

    const result = await approveBankOrder(ORDER_ID, SLIP_ID, "123456");
    expect(result).toMatchObject({ ok: false, code: "not_allowed" });
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("allows approval when isSelfApproval returns false", async () => {
    vi.mocked(isSelfApproval).mockReturnValue(false);
    const db = makeDb();
    vi.mocked(createSupabaseServerClient).mockResolvedValue(db as never);
    vi.mocked(createSupabaseServiceRoleClient).mockResolvedValue(db as never);

    const result = await approveBankOrder(ORDER_ID, SLIP_ID, "123456");
    expect(result.ok).toBe(true);
  });

  it("EC8: Super Admin approving own customer order is still blocked", async () => {
    vi.mocked(requireStaff).mockResolvedValue({
      ok: true,
      user: { ...STAFF, claimedRole: "super_admin" },
    } as never);
    vi.mocked(isSelfApproval).mockReturnValue(true);
    const db = makeDb();
    vi.mocked(createSupabaseServerClient).mockResolvedValue(db as never);
    vi.mocked(createSupabaseServiceRoleClient).mockResolvedValue(db as never);

    const result = await approveBankOrder(ORDER_ID, SLIP_ID, "123456");
    expect(result).toMatchObject({ ok: false, code: "not_allowed" });
  });
});

// ─── AC3: step-up required ────────────────────────────────────────────────────

describe("approveBankOrder — AC3: step-up MFA", () => {
  it("returns mfa_required when requireStepUp throws", async () => {
    vi.mocked(requireStepUp).mockRejectedValue(
      Object.assign(new Error("mfa_required"), { code: "mfa_required" })
    );
    const db = makeDb();
    vi.mocked(createSupabaseServerClient).mockResolvedValue(db as never);
    vi.mocked(createSupabaseServiceRoleClient).mockResolvedValue(db as never);

    const result = await approveBankOrder(ORDER_ID, SLIP_ID, undefined);
    expect(result).toMatchObject({ ok: false, code: "mfa_required" });
  });
});

// ─── AC12: rate limit ─────────────────────────────────────────────────────────

describe("approveBankOrder — AC12: rate limit", () => {
  it("returns rate_limited when limit exceeded", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({
      ok: false, reason: "rate_limited",
    } as never);
    const db = makeDb();
    vi.mocked(createSupabaseServerClient).mockResolvedValue(db as never);
    vi.mocked(createSupabaseServiceRoleClient).mockResolvedValue(db as never);

    const result = await approveBankOrder(ORDER_ID, SLIP_ID, "123456");
    expect(result).toMatchObject({ ok: false, code: "rate_limited" });
  });
});
