// S-084: reject, rejectAndCancel, reopen — AC8, AC9, AC10

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({
  serverConfig: { supabaseServiceRoleKey: "srk" },
  publicConfig: { appUrl: "https://ceylonsafety.lk" },
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
  createSupabaseServiceRoleClient: vi.fn(),
}));
vi.mock("@/lib/auth/server", () => ({ requireStaff: vi.fn() }));
vi.mock("@/lib/auth/step-up", () => ({ requireStepUp: vi.fn(), _resetCacheForTest: vi.fn() }));
vi.mock("@/lib/ratelimit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/resend/client", () => ({
  sendQueuedEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/resend/templates/bank-rejected", () => ({
  renderBankRejectedEmail: vi.fn().mockReturnValue({ subject: "s", html: "<p/>", text: "t" }),
}));

import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/server";
import { requireStepUp, _resetCacheForTest } from "@/lib/auth/step-up";
import { checkRateLimit } from "@/lib/ratelimit";
import {
  rejectBankOrder,
  rejectAndCancelBankOrder,
  reopenBankOrder,
} from "@/lib/admin/actions/bank-transfers";

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

type DbOpts = {
  orderStatus?: string;
  cancelReason?: string | null;
  buyerEmail?: string;
  slipStatus?: string;
  orderCancelCount?: number;
  slipUpdateCount?: number;
};

// Builds a chainable update mock that supports arbitrary .eq() chaining and .in().
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeUpdateChain(result: { error: unknown; count: number | null }): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {};
  chain.eq = vi.fn(() => chain);
  chain.in = vi.fn().mockResolvedValue(result);
  // Thenable: `await update().eq()...` resolves to result.
  chain.then = (
    resolve: (v: unknown) => unknown,
    reject: (e: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject);
  return chain;
}

function makeDb(opts: DbOpts = {}) {
  const {
    orderStatus = "pending_verification",
    cancelReason = null,
    buyerEmail = "buyer@example.com",
    slipStatus = "uploaded",
    orderCancelCount = 1,
    slipUpdateCount = 1,
  } = opts;

  const order = {
    id: ORDER_ID,
    user_id: BUYER_ID,
    status: orderStatus,
    cancel_reason: cancelReason,
    total_cents: 100_000,
    payment_provider: "bank_transfer",
    profiles: { email: buyerEmail, phone: null },
  };
  const slip = {
    id: SLIP_ID, order_id: ORDER_ID,
    status: slipStatus,
    file_key: "slips/test.jpg",
  };

  const auditInsertFn = vi.fn().mockResolvedValue({ error: null });
  const emailInsertFn = vi.fn().mockResolvedValue({ error: null });

  const db = {
    from: vi.fn((table: string) => {
      if (table === "orders") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: order, error: null }),
          update: vi.fn(() => makeUpdateChain({ error: null, count: orderCancelCount })),
        };
      }
      if (table === "bank_transfer_slips") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: slip, error: null }),
          update: vi.fn(() => makeUpdateChain({ error: null, count: slipUpdateCount })),
        };
      }
      if (table === "email_logs") {
        return { insert: emailInsertFn };
      }
      if (table === "admin_audit_log") {
        return { insert: auditInsertFn };
      }
      return {};
    }),
  };

  return { db, auditInsertFn, emailInsertFn };
}

beforeEach(() => {
  vi.clearAllMocks();
  _resetCacheForTest();
  vi.mocked(requireStaff).mockResolvedValue({ ok: true, user: STAFF } as never);
  vi.mocked(requireStepUp).mockResolvedValue(undefined);
  vi.mocked(checkRateLimit).mockResolvedValue({ ok: true } as never);
});

// ─── AC8: rejectBankOrder ─────────────────────────────────────────────────────

describe("rejectBankOrder — AC8", () => {
  it("requires a reason (validation_failed without one)", async () => {
    const { db } = makeDb();
    vi.mocked(createSupabaseServerClient).mockResolvedValue(db as never);
    vi.mocked(createSupabaseServiceRoleClient).mockResolvedValue(db as never);

    const result = await rejectBankOrder(ORDER_ID, SLIP_ID, "", "123456");
    expect(result).toMatchObject({ ok: false, code: "validation_failed" });
  });

  it("sets slip to rejected with reviewer and queues bank_rejected email", async () => {
    const { db, auditInsertFn, emailInsertFn } = makeDb();
    vi.mocked(createSupabaseServerClient).mockResolvedValue(db as never);
    vi.mocked(createSupabaseServiceRoleClient).mockResolvedValue(db as never);

    const result = await rejectBankOrder(ORDER_ID, SLIP_ID, "Wrong bank account", "123456");
    expect(result.ok).toBe(true);
    // AC12: audit row written
    expect(auditInsertFn).toHaveBeenCalledWith(
      expect.objectContaining({ action: "bank_transfer.reject", entity_type: "bank_transfer_slip" })
    );
    // AC13: email queued with correct payload
    expect(emailInsertFn).toHaveBeenCalledWith(
      expect.objectContaining({ status: "queued", related_type: "bank_transfer_slip", template: "bank_rejected" })
    );
  });

  it("requires permission bank_transfers.review", async () => {
    vi.mocked(requireStaff).mockResolvedValue({ ok: false, code: "not_allowed" } as never);
    const result = await rejectBankOrder(ORDER_ID, SLIP_ID, "some reason", "123456");
    expect(result).toMatchObject({ ok: false, code: "not_allowed" });
    expect(vi.mocked(requireStaff)).toHaveBeenCalledWith("bank_transfers.review");
  });

  it("requires step-up code", async () => {
    vi.mocked(requireStepUp).mockRejectedValue(
      Object.assign(new Error("mfa_required"), { code: "mfa_required" })
    );
    const { db } = makeDb();
    vi.mocked(createSupabaseServerClient).mockResolvedValue(db as never);
    vi.mocked(createSupabaseServiceRoleClient).mockResolvedValue(db as never);

    const result = await rejectBankOrder(ORDER_ID, SLIP_ID, "Bad slip", undefined);
    expect(result).toMatchObject({ ok: false, code: "mfa_required" });
  });

  it("returns already_done when slip is already rejected (double-reject guard)", async () => {
    const { db } = makeDb({ slipStatus: "rejected" });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(db as never);
    vi.mocked(createSupabaseServiceRoleClient).mockResolvedValue(db as never);

    const result = await rejectBankOrder(ORDER_ID, SLIP_ID, "some reason", "123456");
    expect(result).toMatchObject({ ok: false, code: "validation_failed", reason: "already_done" });
  });

  it("returns already_done when slip is already accepted (double-reject guard)", async () => {
    const { db } = makeDb({ slipStatus: "accepted" });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(db as never);
    vi.mocked(createSupabaseServiceRoleClient).mockResolvedValue(db as never);

    const result = await rejectBankOrder(ORDER_ID, SLIP_ID, "some reason", "123456");
    expect(result).toMatchObject({ ok: false, code: "validation_failed", reason: "already_done" });
  });

  it("returns already_done when concurrent approval wins the atomic slip update (count=0)", async () => {
    // slipUpdateCount=0 simulates the slip being accepted concurrently between the guard read and the write
    const { db } = makeDb({ slipUpdateCount: 0 });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(db as never);
    vi.mocked(createSupabaseServiceRoleClient).mockResolvedValue(db as never);

    const result = await rejectBankOrder(ORDER_ID, SLIP_ID, "some reason", "123456");
    expect(result).toMatchObject({ ok: false, code: "validation_failed", reason: "already_done" });
  });
});

// ─── AC9: rejectAndCancelBankOrder ───────────────────────────────────────────

describe("rejectAndCancelBankOrder — AC9", () => {
  it("requires a reason", async () => {
    const { db } = makeDb();
    vi.mocked(createSupabaseServerClient).mockResolvedValue(db as never);
    vi.mocked(createSupabaseServiceRoleClient).mockResolvedValue(db as never);

    const result = await rejectAndCancelBankOrder(ORDER_ID, "", "123456");
    expect(result).toMatchObject({ ok: false, code: "validation_failed" });
  });

  it("cancels the order and queues a bank_rejected email", async () => {
    const { db, auditInsertFn, emailInsertFn } = makeDb();
    vi.mocked(createSupabaseServerClient).mockResolvedValue(db as never);
    vi.mocked(createSupabaseServiceRoleClient).mockResolvedValue(db as never);

    const result = await rejectAndCancelBankOrder(ORDER_ID, "Fraudulent slip", "123456");
    expect(result.ok).toBe(true);
    // AC12: audit row written
    expect(auditInsertFn).toHaveBeenCalledWith(
      expect.objectContaining({ action: "bank_transfer.reject", entity_type: "order" })
    );
    // AC13: email queued with correct payload
    expect(emailInsertFn).toHaveBeenCalledWith(
      expect.objectContaining({ status: "queued", related_type: "order", template: "bank_rejected" })
    );
  });

  it("requires bank_transfers.review permission", async () => {
    vi.mocked(requireStaff).mockResolvedValue({ ok: false, code: "not_allowed" } as never);
    const result = await rejectAndCancelBankOrder(ORDER_ID, "reason", "123456");
    expect(result).toMatchObject({ ok: false, code: "not_allowed" });
  });

  it("returns already_done when concurrent payment wins the cancel update (count=0)", async () => {
    // orderCancelCount=0 simulates order being paid concurrently between fetch and cancel
    const { db } = makeDb({ orderCancelCount: 0 });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(db as never);
    vi.mocked(createSupabaseServiceRoleClient).mockResolvedValue(db as never);

    const result = await rejectAndCancelBankOrder(ORDER_ID, "Fraudulent slip", "123456");
    expect(result).toMatchObject({ ok: false, code: "validation_failed", reason: "already_done" });
  });
});

// ─── AC12: rate_limited — rejectBankOrder ────────────────────────────────────

describe("rejectBankOrder — AC12 rate limit", () => {
  it("returns rate_limited when limit exceeded", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ ok: false, code: "rate_limited" } as never);
    const result = await rejectBankOrder(ORDER_ID, SLIP_ID, "Bad slip", "123456");
    expect(result).toMatchObject({ ok: false, code: "rate_limited" });
  });
});

// ─── AC12: rate_limited — rejectAndCancelBankOrder ───────────────────────────

describe("rejectAndCancelBankOrder — AC12 rate limit", () => {
  it("returns rate_limited when limit exceeded", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ ok: false, code: "rate_limited" } as never);
    const result = await rejectAndCancelBankOrder(ORDER_ID, "Bad slip", "123456");
    expect(result).toMatchObject({ ok: false, code: "rate_limited" });
  });
});

// ─── AC10: reopenBankOrder ────────────────────────────────────────────────────

describe("reopenBankOrder — AC10", () => {
  it("requires a note (validation_failed without one)", async () => {
    const { db } = makeDb({ orderStatus: "cancelled", cancelReason: "expired" });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(db as never);
    vi.mocked(createSupabaseServiceRoleClient).mockResolvedValue(db as never);

    const result = await reopenBankOrder(ORDER_ID, "", "123456");
    expect(result).toMatchObject({ ok: false, code: "validation_failed" });
  });

  it("reopens an expired-cancelled order and writes audit row", async () => {
    const { db, auditInsertFn } = makeDb({ orderStatus: "cancelled", cancelReason: "expired" });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(db as never);
    vi.mocked(createSupabaseServiceRoleClient).mockResolvedValue(db as never);

    const result = await reopenBankOrder(ORDER_ID, "Late payment approved by manager", "123456");
    expect(result.ok).toBe(true);
    // AC12: audit row written
    expect(auditInsertFn).toHaveBeenCalledWith(
      expect.objectContaining({ action: "bank_transfer.reopen", entity_type: "order" })
    );
  });

  it("refuses to reopen a non-expired cancellation", async () => {
    const { db } = makeDb({ orderStatus: "cancelled", cancelReason: "buyer_requested" });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(db as never);
    vi.mocked(createSupabaseServiceRoleClient).mockResolvedValue(db as never);

    const result = await reopenBankOrder(ORDER_ID, "Late payment approved", "123456");
    expect(result).toMatchObject({ ok: false, code: "validation_failed" });
  });

  it("requires bank_transfers.review permission", async () => {
    vi.mocked(requireStaff).mockResolvedValue({ ok: false, code: "not_allowed" } as never);
    const result = await reopenBankOrder(ORDER_ID, "note", "123456");
    expect(result).toMatchObject({ ok: false, code: "not_allowed" });
  });

  it("returns already_done when concurrent reopen wins (count=0)", async () => {
    // orderCancelCount=0: the status-guard update touches 0 rows (order already reopened)
    const { db } = makeDb({ orderStatus: "cancelled", cancelReason: "expired", orderCancelCount: 0 });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(db as never);
    vi.mocked(createSupabaseServiceRoleClient).mockResolvedValue(db as never);

    const result = await reopenBankOrder(ORDER_ID, "Late payment approved by manager", "123456");
    expect(result).toMatchObject({ ok: false, code: "already_done" });
  });
});

// ─── AC12: rate_limited — reopenBankOrder ────────────────────────────────────

describe("reopenBankOrder — AC12 rate limit", () => {
  it("returns rate_limited when limit exceeded", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ ok: false, code: "rate_limited" } as never);
    const result = await reopenBankOrder(ORDER_ID, "Late payment approved", "123456");
    expect(result).toMatchObject({ ok: false, code: "rate_limited" });
  });
});
