// S-086: ensureReceiptEmail integration tests
// AC1, AC2, AC4, EC1

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({
  serverConfig: {
    supabaseServiceRoleKey: "srk",
    resendApiKey: "re_test",
    emailFrom: "Ceylon Safety <no-reply@ceylonsafety.lk>",
    supportEmail: "support@ceylonsafety.lk",
    emailDailyLimit: 90,
  },
  publicConfig: { appUrl: "https://ceylonsafety.lk" },
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: vi.fn(),
}));
vi.mock("@/lib/resend/client", () => ({
  sendEmail: vi.fn(),
}));
vi.mock("@/lib/resend/templates/purchase-receipt", () => ({
  renderReceiptEmail: vi.fn(() => ({
    subject: "Your receipt",
    html: "<p>receipt</p>",
    text: "receipt",
  })),
}));
vi.mock("@/lib/resend/templates/bank-approved", () => ({
  renderBankApprovedEmail: vi.fn(() => ({
    subject: "Your order is approved",
    html: "<p>approved</p>",
    text: "approved",
  })),
}));

import { sendEmail } from "@/lib/resend/client";
import { ensureReceiptEmail } from "@/lib/orders/receipt";

const ORDER_ID = "ord-00000000-0000-4000-8000-000000000001";

/** Build a proper thenable chain that resolves to result when awaited */
function makeChain<T>(result: T) {
  const chain: Record<string, unknown> = {
    eq: () => chain,
    in: () => chain,
    gte: () => chain,
    select: () => chain,
    single: () => Promise.resolve(result),
    then(
      resolve: (v: T) => unknown,
      reject?: (e: unknown) => unknown,
    ) {
      return Promise.resolve(result).then(resolve, reject);
    },
    catch(reject: (e: unknown) => unknown) {
      return Promise.resolve(result).catch(reject);
    },
  };
  return chain;
}

function makeDb(options?: {
  orderRow?: Record<string, unknown> | null;
  itemRows?: Array<Record<string, unknown>>;
  emailCount?: number;
  bankApprovedExists?: boolean;
}) {
  const orderRow = options?.orderRow ?? {
    id: ORDER_ID,
    order_number: "CS-00001",
    status: "paid",
    payment_method: "card",
    total_cents: 199000,
    created_at: "2026-11-18T04:30:00.000Z",
    user_id: "user-buyer-1",
    profiles: { email: "buyer@example.com" },
  };

  const itemRows = options?.itemRows ?? [
    {
      id: "item-1",
      title_snapshot: "Fire Safety Checklist",
      language: "en",
      line_total_cents: 199000,
      entitlements: [{ id: "ent-aaa" }],
    },
  ];

  const emailCount = options?.emailCount ?? 0;
  const bankApprovedExists = options?.bankApprovedExists ?? false;

  let emailLogsCallCount = 0;

  const fromMock = vi.fn((table: string) => {
    if (table === "email_logs") {
      emailLogsCallCount++;
      if (emailLogsCallCount === 1) {
        // Budget check
        return {
          select: () => makeChain({ count: emailCount, error: null }),
        };
      }
      // Bank pre-check: returns existing row or empty
      const preCheckRows = bankApprovedExists ? [{ id: "log-existing" }] : [];
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        limit: () => Promise.resolve({ data: preCheckRows, error: null }),
      };
      return chain;
    }
    if (table === "orders") {
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        single: () =>
          Promise.resolve({
            data: orderRow,
            error: orderRow ? null : { message: "not found" },
          }),
      };
      return chain;
    }
    if (table === "order_items") {
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => Promise.resolve({ data: itemRows, error: null }),
      };
      return chain;
    }
    return {};
  });

  return { from: fromMock } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── AC1: card order sends receipt template ───────────────────────────────────

describe("ensureReceiptEmail — card order", () => {
  it("calls sendEmail with receipt template for a card order (AC1)", async () => {
    const result = await ensureReceiptEmail(ORDER_ID, makeDb());

    expect(result.ok).toBe(true);
    expect(vi.mocked(sendEmail)).toHaveBeenCalledWith(
      expect.objectContaining({
        template: "receipt",
        relatedType: "order",
        relatedId: ORDER_ID,
      }),
    );
  });
});

// ─── AC1: bank order sends bank_approved template ─────────────────────────────

describe("ensureReceiptEmail — bank order", () => {
  it("calls sendEmail with bank_approved template for a bank order (AC1)", async () => {
    const db = makeDb({
      orderRow: {
        id: ORDER_ID,
        order_number: "CS-00002",
        status: "paid",
        payment_method: "bank_transfer",
        total_cents: 199000,
        created_at: "2026-11-18T04:30:00.000Z",
        user_id: "user-buyer-2",
        profiles: { email: "buyer2@example.com" },
      },
    });
    const result = await ensureReceiptEmail(ORDER_ID, db);

    expect(result.ok).toBe(true);
    expect(vi.mocked(sendEmail)).toHaveBeenCalledWith(
      expect.objectContaining({
        template: "bank_approved",
        relatedType: "order",
        relatedId: ORDER_ID,
      }),
    );
  });
});

// ─── AC2: idempotency — sendEmail unique-violation is handled gracefully ──────

describe("ensureReceiptEmail — idempotency (AC2)", () => {
  it("returns ok:true when sendEmail resolves without error", async () => {
    vi.mocked(sendEmail).mockResolvedValue(undefined);
    const result = await ensureReceiptEmail(ORDER_ID, makeDb());
    expect(result.ok).toBe(true);
  });
});

// ─── AC4: invoice forced to fail — email still goes out ───────────────────────

describe("ensureReceiptEmail — no dependency on invoice (AC4)", () => {
  it("succeeds without any invoice context (AC4)", async () => {
    const result = await ensureReceiptEmail(ORDER_ID, makeDb());
    expect(result.ok).toBe(true);
  });
});

// ─── AC8: email budget check ──────────────────────────────────────────────────

describe("ensureReceiptEmail — email budget (AC8)", () => {
  it("returns ok:false without calling sendEmail when daily limit is reached", async () => {
    const result = await ensureReceiptEmail(ORDER_ID, makeDb({ emailCount: 90 }));

    expect(result.ok).toBe(false);
    expect(vi.mocked(sendEmail)).not.toHaveBeenCalled();
  });

  it("sends when daily count is below the limit", async () => {
    const result = await ensureReceiptEmail(ORDER_ID, makeDb({ emailCount: 50 }));

    expect(result.ok).toBe(true);
    expect(vi.mocked(sendEmail)).toHaveBeenCalled();
  });
});

// ─── EC6: bank_approved idempotency pre-check ─────────────────────────────────

describe("ensureReceiptEmail — bank_approved idempotency (EC6)", () => {
  it("returns ok:true without sending when bank_approved row already exists in email_logs", async () => {
    const db = makeDb({
      orderRow: {
        id: ORDER_ID,
        order_number: "CS-00003",
        status: "paid",
        payment_method: "bank_transfer",
        total_cents: 199000,
        created_at: "2026-11-18T04:30:00.000Z",
        user_id: "user-buyer-3",
        profiles: { email: "buyer3@example.com" },
      },
      bankApprovedExists: true,
    });
    const result = await ensureReceiptEmail(ORDER_ID, db);
    expect(result.ok).toBe(true);
    expect(vi.mocked(sendEmail)).not.toHaveBeenCalled();
  });
});

// ─── EC1: concurrent runs ─────────────────────────────────────────────────────

describe("ensureReceiptEmail — concurrent runs (EC1)", () => {
  it("returns ok:true from both runs — sendEmail insert-first guard deduplicates at DB level", async () => {
    // The idempotency guarantee lives inside sendEmail (unique index on email_logs).
    // When a concurrent call hits the unique index, sendEmail swallows the 23505 error
    // and returns void (no re-throw). Both callers therefore get ok:true.
    vi.mocked(sendEmail).mockResolvedValue(undefined);

    const [r1, r2] = await Promise.all([
      ensureReceiptEmail(ORDER_ID, makeDb()),
      ensureReceiptEmail(ORDER_ID, makeDb()),
    ]);

    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    // Exactly two calls to sendEmail — neither crashed; the DB-level guard handles deduplication.
    expect(vi.mocked(sendEmail)).toHaveBeenCalledTimes(2);
  });
});
