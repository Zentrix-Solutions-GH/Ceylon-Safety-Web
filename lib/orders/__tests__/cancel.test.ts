// S-078: cancelPendingOrder unit tests (AC12, EC8)

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
  createSupabaseServiceRoleClient: vi.fn(),
}));
vi.mock("@/lib/auth/server", () => ({ requireActiveAccount: vi.fn() }));

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireActiveAccount } from "@/lib/auth/server";
import { cancelPendingOrder } from "@/lib/orders/create";

const mockRequireActiveAccount = vi.mocked(requireActiveAccount);
const mockCreateClient = vi.mocked(createSupabaseServerClient);

const fakeUser = { id: "user-3", email: "buyer@example.com", status: "active" };
const fakeOrderId = "00000000-0000-4000-8000-000000000099";

function makeDb(orderOverrides: Record<string, unknown> = {}) {
  const fakeOrder = {
    id: fakeOrderId,
    user_id: fakeUser.id,
    status: "pending",
    payment_provider: "payhere",
    payment_method: null,
    ...orderOverrides,
  };

  const chain: Record<string, unknown> = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: fakeOrder, error: null }),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    rpc: vi.fn(),
  };
  return { chain, fakeOrder };
}

beforeEach(() => vi.clearAllMocks());

// ─── Input validation ────────────────────────────────────────────────────────

describe("cancelPendingOrder — input validation", () => {
  it("returns validation_failed for a non-UUID orderId", async () => {
    const result = await cancelPendingOrder("not-a-uuid");
    expect(result).toMatchObject({ ok: false, code: "validation_failed" });
  });
});

// ─── AC12: auth gate ─────────────────────────────────────────────────────────

describe("cancelPendingOrder — auth gate", () => {
  it("returns not_allowed when signed out", async () => {
    mockRequireActiveAccount.mockResolvedValue({ ok: false, code: "reauth_required" } as never);
    const result = await cancelPendingOrder(fakeOrderId);
    expect(result).toMatchObject({ ok: false, code: "not_allowed" });
  });
});

// ─── AC12: owner-only ────────────────────────────────────────────────────────

describe("cancelPendingOrder — owner only", () => {
  it("returns not_allowed for another user's order", async () => {
    mockRequireActiveAccount.mockResolvedValue({ ok: true, user: fakeUser } as never);
    const { chain } = makeDb({ user_id: "other-user-id" });
    mockCreateClient.mockResolvedValue(chain as never);

    const result = await cancelPendingOrder(fakeOrderId);
    expect(result).toMatchObject({ ok: false, code: "not_allowed" });
  });
});

// ─── AC12: card order cancel ─────────────────────────────────────────────────

describe("cancelPendingOrder — card order", () => {
  beforeEach(() => {
    mockRequireActiveAccount.mockResolvedValue({ ok: true, user: fakeUser } as never);
  });

  it("cancels a pending card order with no PayHere event", async () => {
    const { chain } = makeDb({ status: "pending", payment_provider: "payhere" });
    // payment_events: none
    (chain.single as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ data: { id: fakeOrderId, user_id: fakeUser.id, status: "pending", payment_provider: "payhere" }, error: null }) // order fetch
      .mockResolvedValueOnce({ data: null, error: null }); // payment_events check (none)
    // update: success
    (chain.eq as ReturnType<typeof vi.fn>).mockReturnThis();
    (chain.update as ReturnType<typeof vi.fn>).mockReturnThis();
    mockCreateClient.mockResolvedValue(chain as never);

    const result = await cancelPendingOrder(fakeOrderId);
    expect(result).toMatchObject({ ok: true });
  });

  it("returns payment_in_progress when PayHere has a pending event", async () => {
    const { chain } = makeDb({ status: "pending", payment_provider: "payhere" });
    (chain.single as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ data: { id: fakeOrderId, user_id: fakeUser.id, status: "pending", payment_provider: "payhere" }, error: null })
      .mockResolvedValueOnce({ data: { id: "evt-1", status: "pending" }, error: null }); // pending payment event
    mockCreateClient.mockResolvedValue(chain as never);

    const result = await cancelPendingOrder(fakeOrderId);
    expect(result).toMatchObject({ ok: false, code: "payment_in_progress" });
  });

  it("returns validation_failed for already cancelled order", async () => {
    const { chain } = makeDb({ status: "cancelled" });
    (chain.single as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { id: fakeOrderId, user_id: fakeUser.id, status: "cancelled", payment_provider: "payhere" },
      error: null,
    });
    mockCreateClient.mockResolvedValue(chain as never);

    const result = await cancelPendingOrder(fakeOrderId);
    expect(result).toMatchObject({ ok: false, code: "validation_failed", reason: "already_done" });
  });

  it("returns validation_failed for paid order", async () => {
    const { chain } = makeDb({ status: "paid" });
    (chain.single as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { id: fakeOrderId, user_id: fakeUser.id, status: "paid", payment_provider: "payhere" },
      error: null,
    });
    mockCreateClient.mockResolvedValue(chain as never);

    const result = await cancelPendingOrder(fakeOrderId);
    expect(result).toMatchObject({ ok: false, code: "validation_failed", reason: "already_done" });
  });
});

// ─── AC12: bank order cancel (EC8) ───────────────────────────────────────────

describe("cancelPendingOrder — bank order (EC8)", () => {
  beforeEach(() => {
    mockRequireActiveAccount.mockResolvedValue({ ok: true, user: fakeUser } as never);
  });

  it("cancels a bank order when no slip uploaded", async () => {
    const { chain } = makeDb({ status: "pending_verification", payment_provider: "bank_transfer" });
    (chain.single as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ data: { id: fakeOrderId, user_id: fakeUser.id, status: "pending_verification", payment_provider: "bank_transfer" }, error: null })
      .mockResolvedValueOnce({ data: null, error: null }); // no bank_slips row
    (chain.update as ReturnType<typeof vi.fn>).mockReturnThis();
    mockCreateClient.mockResolvedValue(chain as never);

    const result = await cancelPendingOrder(fakeOrderId);
    expect(result).toMatchObject({ ok: true });
  });

  it("returns not_allowed when slip already uploaded (EC8)", async () => {
    const { chain } = makeDb({ status: "pending_verification", payment_provider: "bank_transfer" });
    (chain.single as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ data: { id: fakeOrderId, user_id: fakeUser.id, status: "pending_verification", payment_provider: "bank_transfer" }, error: null })
      .mockResolvedValueOnce({ data: { id: "slip-1" }, error: null }); // slip exists
    mockCreateClient.mockResolvedValue(chain as never);

    const result = await cancelPendingOrder(fakeOrderId);
    expect(result).toMatchObject({ ok: false, code: "not_allowed" });
  });
});
