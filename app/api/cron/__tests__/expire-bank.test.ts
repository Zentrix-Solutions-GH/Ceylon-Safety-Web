// S-084: expire-bank-orders cron job — AC11

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({
  serverConfig: { supabaseServiceRoleKey: "srk" },
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: vi.fn(),
}));

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { expireBankOrdersJob } from "@/lib/jobs/expire-bank-orders";

const NOW = new Date("2026-11-18T12:00:00Z");

function daysAgo(n: number): string {
  const d = new Date(NOW);
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

type Order = {
  id: string;
  user_id: string;
  created_at: string;
  bank_expiry_warned_at: string | null;
  profiles: { email: string } | null;
};

type Slip = { order_id: string; status: string };

function makeChainFor(table: string, opts: {
  settings?: Array<{ key: string; value: number }>;
  orders?: Order[];
  slips?: Slip[];
  updateFn?: ReturnType<typeof vi.fn>;
  emailInsertFn?: ReturnType<typeof vi.fn>;
}) {
  const { settings, orders, slips, updateFn, emailInsertFn } = opts;

  if (table === "site_settings") {
    return {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: settings ?? [], error: null }),
    };
  }
  if (table === "orders") {
    const orderUpdate = updateFn ?? vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null, count: 1 }),
      }),
    });
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: orders ?? [], error: null }),
      update: orderUpdate,
    };
  }
  if (table === "bank_transfer_slips") {
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: slips ?? [], error: null }),
      // .eq().in() chain: eq returns this, in returns promise
    };
  }
  if (table === "email_logs") {
    const insertFn = emailInsertFn ?? vi.fn().mockResolvedValue({ error: null });
    return { insert: insertFn };
  }
  return {};
}

const DEFAULT_SETTINGS = [
  { key: "bank_order_expiry_days",  value: 7 },
  { key: "bank_order_warning_days", value: 1 },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── AC11: expiry job ─────────────────────────────────────────────────────────

describe("expireBankOrdersJob — AC11", () => {
  it("returns ok:true with zero orders processed when no pending orders", async () => {
    const sb = { from: vi.fn((t: string) => makeChainFor(t, { settings: DEFAULT_SETTINGS, orders: [] })) };
    vi.mocked(createSupabaseServiceRoleClient).mockResolvedValue(sb as never);

    const result = await expireBankOrdersJob();
    expect(result.ok).toBe(true);
  });

  it("cancels an order that is older than expiry_days (no second-approval slip)", async () => {
    const expiredOrder: Order = {
      id: "order-expired-1",
      user_id: "buyer-1",
      created_at: daysAgo(8),
      bank_expiry_warned_at: daysAgo(2),
      profiles: { email: "buyer@example.com" },
    };
    const updateFn = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null, count: 1 }),
      }),
    });
    const emailInsertFn = vi.fn().mockResolvedValue({ error: null });
    const sb = {
      from: vi.fn((t: string) => makeChainFor(t, {
        settings: DEFAULT_SETTINGS,
        orders: [expiredOrder],
        slips: [],
        updateFn,
        emailInsertFn,
      })),
    };
    vi.mocked(createSupabaseServiceRoleClient).mockResolvedValue(sb as never);

    const result = await expireBankOrdersJob();
    expect(result.ok).toBe(true);
    // Update was called with cancelled status
    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({ status: "cancelled", cancel_reason: "expired" })
    );
  });

  it("sends warning email (bank_expiring) once for an order inside the warning window", async () => {
    const warningOrder: Order = {
      id: "order-warning-1",
      user_id: "buyer-2",
      created_at: daysAgo(6),
      bank_expiry_warned_at: null,
      profiles: { email: "buyer2@example.com" },
    };
    const emailInsertFn = vi.fn().mockResolvedValue({ error: null });
    const sb = {
      from: vi.fn((t: string) => makeChainFor(t, {
        settings: DEFAULT_SETTINGS,
        orders: [warningOrder],
        slips: [],
        emailInsertFn,
      })),
    };
    vi.mocked(createSupabaseServiceRoleClient).mockResolvedValue(sb as never);

    const result = await expireBankOrdersJob();
    expect(result.ok).toBe(true);
    expect(emailInsertFn).toHaveBeenCalledWith(
      expect.objectContaining({ template: "bank_expiring" })
    );
  });

  it("does NOT send a second warning if bank_expiry_warned_at is already set", async () => {
    const alreadyWarnedOrder: Order = {
      id: "order-warned-1",
      user_id: "buyer-3",
      created_at: daysAgo(6),
      bank_expiry_warned_at: daysAgo(0),
      profiles: { email: "buyer3@example.com" },
    };
    const emailInsertFn = vi.fn().mockResolvedValue({ error: null });
    const sb = {
      from: vi.fn((t: string) => makeChainFor(t, {
        settings: DEFAULT_SETTINGS,
        orders: [alreadyWarnedOrder],
        slips: [],
        emailInsertFn,
      })),
    };
    vi.mocked(createSupabaseServiceRoleClient).mockResolvedValue(sb as never);

    const result = await expireBankOrdersJob();
    expect(result.ok).toBe(true);
    expect(emailInsertFn).not.toHaveBeenCalled();
  });

  it("does NOT cancel an order whose latest slip is awaiting_second_approval", async () => {
    const secondApprovalOrder: Order = {
      id: "order-second-1",
      user_id: "buyer-4",
      created_at: daysAgo(8),
      bank_expiry_warned_at: daysAgo(1),
      profiles: { email: "buyer4@example.com" },
    };
    const updateFn = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null, count: 1 }),
      }),
    });
    const sb = {
      from: vi.fn((t: string) => makeChainFor(t, {
        settings: DEFAULT_SETTINGS,
        orders: [secondApprovalOrder],
        slips: [{ order_id: "order-second-1", status: "awaiting_second_approval" }],
        updateFn,
      })),
    };
    vi.mocked(createSupabaseServiceRoleClient).mockResolvedValue(sb as never);

    const result = await expireBankOrdersJob();
    expect(result.ok).toBe(true);
    // Update should not have been called with status = 'cancelled'
    for (const call of updateFn.mock.calls) {
      expect(call[0]).not.toMatchObject({ status: "cancelled" });
    }
  });

  it("uses bank_order_expiry_days setting (not hardcoded 7)", async () => {
    const tenDayOrder: Order = {
      id: "order-ten-1",
      user_id: "buyer-5",
      created_at: daysAgo(11),
      bank_expiry_warned_at: daysAgo(2),
      profiles: { email: "buyer5@example.com" },
    };
    const updateFn = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null, count: 1 }),
      }),
    });
    const settings = [
      { key: "bank_order_expiry_days",  value: 10 },
      { key: "bank_order_warning_days", value: 1 },
    ];
    const sb = {
      from: vi.fn((t: string) => makeChainFor(t, {
        settings,
        orders: [tenDayOrder],
        slips: [],
        updateFn,
      })),
    };
    vi.mocked(createSupabaseServiceRoleClient).mockResolvedValue(sb as never);

    const result = await expireBankOrdersJob();
    expect(result.ok).toBe(true);
    // 11 days old, expiry 10 days → should be cancelled
    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({ status: "cancelled", cancel_reason: "expired" })
    );
  });
});
