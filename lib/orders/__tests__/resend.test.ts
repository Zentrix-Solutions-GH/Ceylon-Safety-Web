// S-086: resendMyReceiptLib integration tests
// AC5, EC5

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
  REFUND_POLICY_PATH: "/refund-policy",
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

import { sendEmail } from "@/lib/resend/client";
import { resendMyReceiptLib, resendReceiptForOrder } from "@/lib/orders/resend-receipt";

const ORDER_ID = "ord-00000000-0000-4000-8000-000000000002";
const USER_ID = "user-buyer-99";

/** Build a proper thenable chain */
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

function makeDb(options?: { resendCount?: number; isOwner?: boolean; resendCountError?: boolean; suspended?: boolean }) {
  const resendCount = options?.resendCount ?? 0;
  const resendCountError = options?.resendCountError ?? false;
  const isOwner = options?.isOwner !== false;
  const profileStatus = options?.suspended ? "suspended" : "active";

  const orderRow = isOwner
    ? {
        id: ORDER_ID,
        order_number: "CS-00005",
        status: "paid",
        payment_method: "card",
        total_cents: 199000,
        created_at: "2026-11-18T04:30:00.000Z",
        user_id: USER_ID,
        profiles: { email: "buyer99@example.com", status: profileStatus },
      }
    : null;

  const itemRows = [
    {
      id: "item-99",
      title_snapshot: "Safety Signs Pack",
      language: "en",
      line_total_cents: 199000,
      entitlements: [{ id: "ent-yyy" }],
    },
  ];

  let emailLogsCallCount = 0;

  const fromMock = vi.fn((table: string) => {
    if (table === "email_logs") {
      emailLogsCallCount++;
      if (emailLogsCallCount === 1) {
        // Budget check — below limit
        return { select: () => makeChain({ count: 0, error: null }) };
      }
      // Resend rate-limit check
      const rateResult = resendCountError
        ? { count: null, error: { message: "db error" } }
        : { count: resendCount, error: null };
      return { select: () => makeChain(rateResult) };
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

// ─── AC5: owner only ──────────────────────────────────────────────────────────

describe("resendMyReceiptLib — owner only (AC5)", () => {
  it("sends receipt_resend template when called by the order owner", async () => {
    const result = await resendMyReceiptLib(ORDER_ID, USER_ID, makeDb());
    expect(result.ok).toBe(true);
    expect(vi.mocked(sendEmail)).toHaveBeenCalledWith(
      expect.objectContaining({ template: "receipt_resend" }),
    );
  });

  it("returns error when called by a non-owner user (AC5)", async () => {
    const result = await resendMyReceiptLib(ORDER_ID, "other-user", makeDb({ isOwner: false }));
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not found|forbidden|not allowed/i);
    expect(vi.mocked(sendEmail)).not.toHaveBeenCalled();
  });

  it("blocks a suspended account (AC5 active-account guard)", async () => {
    const result = await resendMyReceiptLib(ORDER_ID, USER_ID, makeDb({ suspended: true }));
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not active|suspended/i);
    expect(vi.mocked(sendEmail)).not.toHaveBeenCalled();
  });
});

// ─── EC5: rate limit — 3 per day per order ────────────────────────────────────

describe("resendMyReceiptLib — rate limit (EC5)", () => {
  it("allows up to 3 resends per day", async () => {
    const result = await resendMyReceiptLib(ORDER_ID, USER_ID, makeDb({ resendCount: 2 }));
    expect(result.ok).toBe(true);
  });

  it("refuses the 4th resend in a day (EC5)", async () => {
    const result = await resendMyReceiptLib(ORDER_ID, USER_ID, makeDb({ resendCount: 3 }));
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/rate.?limit|too many/i);
    expect(vi.mocked(sendEmail)).not.toHaveBeenCalled();
  });

  it("fails closed when the rate-limit DB query errors (P1)", async () => {
    const result = await resendMyReceiptLib(ORDER_ID, USER_ID, makeDb({ resendCountError: true }));
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/rate.?limit|verify/i);
    expect(vi.mocked(sendEmail)).not.toHaveBeenCalled();
  });
});

// ─── AC6: admin resend path ───────────────────────────────────────────────────

function makeDbAdmin() {
  const orderRow = {
    id: ORDER_ID,
    order_number: "CS-00005",
    status: "paid",
    payment_method: "card",
    total_cents: 199000,
    created_at: "2026-11-18T04:30:00.000Z",
    user_id: USER_ID,
    profiles: { email: "buyer99@example.com" },
  };
  const itemRows = [
    {
      id: "item-99",
      title_snapshot: "Safety Signs Pack",
      language: "en",
      line_total_cents: 199000,
      entitlements: [{ id: "ent-yyy" }],
    },
  ];
  const fromMock = vi.fn((table: string) => {
    if (table === "email_logs") {
      // Budget check — below limit
      return { select: () => makeChain({ count: 0, error: null }) };
    }
    if (table === "orders") {
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        single: () => Promise.resolve({ data: orderRow, error: null }),
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

describe("resendReceiptForOrder — admin path (AC6)", () => {
  it("sends receipt_resend without an owner check (AC6)", async () => {
    const result = await resendReceiptForOrder(ORDER_ID, makeDbAdmin());
    expect(result.ok).toBe(true);
    expect(vi.mocked(sendEmail)).toHaveBeenCalledWith(
      expect.objectContaining({ template: "receipt_resend" }),
    );
  });
});
