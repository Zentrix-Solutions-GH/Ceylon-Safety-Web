// S-084: getBankTransferQueue and signed-link route — AC1, AC2, permission checks

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({
  serverConfig: { supabaseServiceRoleKey: "srk" },
  r2Config: vi.fn(() => ({
    bucketPrivate: "test-private",
    accountId: "acct",
    accessKeyId: "key",
    secretAccessKey: "secret",
    publicMediaBaseUrl: "https://cdn.test",
  })),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
  createSupabaseServiceRoleClient: vi.fn(),
}));
vi.mock("@/lib/auth/server", () => ({ requireStaff: vi.fn() }));
vi.mock("@/lib/r2/storage", () => ({ presignedGet: vi.fn() }));

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/server";
import { getBankTransferQueue } from "@/lib/admin/actions/bank-transfers";

const STAFF = {
  id: "staff-01",
  email: "staff@example.com",
  claimedRole: "admin" as const,
  hasTotpEnrolled: true,
  hasAuthenticatorLevel: true,
};

const ORDER_ID = "00000000-0000-4000-8000-000000000001";
const SLIP_ID = "00000000-0000-4000-8000-000000000011";

function mockStaffAuth(ok = true) {
  if (ok) {
    vi.mocked(requireStaff).mockResolvedValue({ ok: true, user: STAFF } as never);
  } else {
    vi.mocked(requireStaff).mockResolvedValue({ ok: false, code: "not_allowed" } as never);
  }
}

function makeQueueRow(overrides = {}) {
  return {
    order_id: ORDER_ID,
    order_number: "ORD-2026-001",
    created_at: "2026-11-01T00:00:00Z",
    total_cents: 100000,
    buyer_name: "Test Buyer",
    latest_slip_id: SLIP_ID,
    latest_slip_uploaded_at: "2026-11-01T12:00:00Z",
    awaiting_second_approval: false,
    ...overrides,
  };
}


beforeEach(() => {
  vi.clearAllMocks();
});

// ─── AC1: permission gate ─────────────────────────────────────────────────────

describe("getBankTransferQueue — permission gate", () => {
  it("returns not_allowed when staff auth fails", async () => {
    mockStaffAuth(false);
    const result = await getBankTransferQueue();
    expect(result).toMatchObject({ ok: false, code: "not_allowed" });
    expect(vi.mocked(requireStaff)).toHaveBeenCalledWith("bank_transfers.review");
  });
});

// ─── AC1: queue shape ─────────────────────────────────────────────────────────

describe("getBankTransferQueue — queue shape", () => {
  it("returns pending and secondApproval arrays on success", async () => {
    mockStaffAuth();
    const db = {
      from: vi.fn((table: string) => {
        if (table === "bank_transfer_queue") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            then: vi.fn().mockResolvedValue({ data: [makeQueueRow()], error: null }),
          };
        }
        return {};
      }),
    };
    vi.mocked(createSupabaseServerClient).mockResolvedValue(db as never);

    const result = await getBankTransferQueue();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data!.pending).toHaveLength(1);
    expect(result.data!.secondApproval).toHaveLength(0);
    expect(result.data!.pending[0]).toMatchObject({
      orderId: ORDER_ID,
      orderNumber: "ORD-2026-001",
      amountCents: 100000,
      awaitingSecondApproval: false,
    });
  });

  it("puts awaiting_second_approval rows into the secondApproval bucket", async () => {
    mockStaffAuth();
    const rows = [
      makeQueueRow({ awaiting_second_approval: false }),
      makeQueueRow({ order_id: "other-order", awaiting_second_approval: true }),
    ];
    const db = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        then: vi.fn().mockResolvedValue({ data: rows, error: null }),
      })),
    };
    vi.mocked(createSupabaseServerClient).mockResolvedValue(db as never);

    const result = await getBankTransferQueue();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data!.pending).toHaveLength(1);
    expect(result.data!.secondApproval).toHaveLength(1);
  });
});

// ─── Role checks ─────────────────────────────────────────────────────────────

describe("getBankTransferQueue — role checks", () => {
  it("non-staff (customer) is refused", async () => {
    vi.mocked(requireStaff).mockResolvedValue({ ok: false, code: "not_allowed" } as never);
    const result = await getBankTransferQueue();
    expect(result).toMatchObject({ ok: false, code: "not_allowed" });
  });
});
