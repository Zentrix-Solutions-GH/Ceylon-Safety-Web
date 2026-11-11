// S-078: cancelPendingOrder unit tests (AC12, EC8)
// cancelPendingOrder now delegates entirely to the cancel_order_locked RPC,
// which runs the checks + UPDATE atomically. Tests verify the TypeScript
// action-string → ActionResult mapping.

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

function makeDb(rpcAction: string) {
  return {
    rpc: vi.fn().mockResolvedValue({ data: { action: rpcAction }, error: null }),
  };
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

// ─── RPC action mapping ──────────────────────────────────────────────────────

describe("cancelPendingOrder — RPC action mapping", () => {
  beforeEach(() => {
    mockRequireActiveAccount.mockResolvedValue({ ok: true, user: fakeUser } as never);
  });

  it("cancelled → ok: true", async () => {
    mockCreateClient.mockResolvedValue(makeDb("cancelled") as never);
    expect(await cancelPendingOrder(fakeOrderId)).toMatchObject({ ok: true });
  });

  it("not_found → not_found", async () => {
    mockCreateClient.mockResolvedValue(makeDb("not_found") as never);
    expect(await cancelPendingOrder(fakeOrderId)).toMatchObject({ ok: false, code: "not_found" });
  });

  // AC12: already cancelled / paid / failed / refunded
  it("already_done → validation_failed with reason already_done", async () => {
    mockCreateClient.mockResolvedValue(makeDb("already_done") as never);
    expect(await cancelPendingOrder(fakeOrderId)).toMatchObject({
      ok: false,
      code: "validation_failed",
      reason: "already_done",
    });
  });

  // AC12: PayHere event in flight
  it("payment_in_progress → payment_in_progress", async () => {
    mockCreateClient.mockResolvedValue(makeDb("payment_in_progress") as never);
    expect(await cancelPendingOrder(fakeOrderId)).toMatchObject({
      ok: false,
      code: "payment_in_progress",
    });
  });

  // AC12/EC8: bank slip uploaded
  it("slip_uploaded → not_allowed (EC8)", async () => {
    mockCreateClient.mockResolvedValue(makeDb("slip_uploaded") as never);
    expect(await cancelPendingOrder(fakeOrderId)).toMatchObject({ ok: false, code: "not_allowed" });
  });

  // Unknown future action
  it("unknown RPC action → unknown error code", async () => {
    mockCreateClient.mockResolvedValue(makeDb("unexpected_state") as never);
    expect(await cancelPendingOrder(fakeOrderId)).toMatchObject({ ok: false, code: "unknown" });
  });

  // RPC error
  it("RPC error → unknown", async () => {
    mockCreateClient.mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "db error" } }),
    } as never);
    expect(await cancelPendingOrder(fakeOrderId)).toMatchObject({ ok: false, code: "unknown" });
  });

  // AC12: another user's order — the RPC enforces ownership via auth.uid() assertion
  // and WHERE user_id = p_user_id, returning not_found rather than not_allowed
  it("another user's order → not_found (RPC ownership check)", async () => {
    mockCreateClient.mockResolvedValue(makeDb("not_found") as never);
    expect(await cancelPendingOrder(fakeOrderId)).toMatchObject({ ok: false, code: "not_found" });
  });
});
