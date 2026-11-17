// S-083: getBankOrderView unit tests (AC6, EC6)

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));
vi.mock("@/lib/auth/server", () => ({ requireActiveAccount: vi.fn() }));

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireActiveAccount } from "@/lib/auth/server";
import { getBankOrderView } from "@/lib/bank/slips";

const mockRequireActiveAccount = vi.mocked(requireActiveAccount);
const mockCreateClient = vi.mocked(createSupabaseServerClient);

const fakeUser = { id: "user-buyer-1", email: "buyer@example.com", status: "active" };
const otherUser = { id: "user-other-99", email: "other@example.com", status: "active" };
const fakeOrderId = "00000000-0000-4000-8000-000000000001";
const fakeOrderNumber = "CS-2026-00001";

function makeSlipRow(overrides = {}) {
  return {
    id: "slip-1",
    status: "uploaded",
    uploaded_at: "2026-11-17T10:00:00Z",
    rejection_reason: null,
    file_key: "slips/order-1/slip-uuid.jpg", // MUST NOT appear in the view output
    ...overrides,
  };
}

const DEFAULT_SETTING_ROW = { value: "Account: 1234567890, Bank: BOC" };

function makeDb(overrides: {
  orderRow?: unknown;
  orderError?: unknown;
  slipRows?: unknown[];
  settingRow?: unknown | null;
  noSetting?: boolean;
} = {}) {
  const orderRow = overrides.orderRow ?? {
    id: fakeOrderId,
    user_id: fakeUser.id,
    order_number: fakeOrderNumber,
    status: "pending_verification",
    payment_provider: "bank_transfer",
  };
  const slipRows = overrides.slipRows ?? [makeSlipRow()];
  const settingRow = overrides.noSetting ? null : (overrides.settingRow !== undefined ? overrides.settingRow : DEFAULT_SETTING_ROW);

  return {
    from: vi.fn((table: string) => {
      if (table === "orders") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: overrides.orderError ? null : orderRow,
            error: overrides.orderError ?? null,
          }),
        };
      }
      if (table === "bank_transfer_slips") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: slipRows, error: null }),
        };
      }
      if (table === "site_settings") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: settingRow, error: null }),
        };
      }
      return {};
    }),
  };
}

beforeEach(() => vi.clearAllMocks());

// ─── Auth gate ────────────────────────────────────────────────────────────────

describe("getBankOrderView — auth gate", () => {
  it("returns not_allowed when signed out", async () => {
    mockRequireActiveAccount.mockResolvedValue({ ok: false, code: "reauth_required" } as never);
    const result = await getBankOrderView(fakeOrderId);
    expect(result).toMatchObject({ ok: false, code: "not_allowed" });
  });

  it("returns validation_failed for a non-UUID orderId", async () => {
    mockRequireActiveAccount.mockResolvedValue({ ok: true, user: fakeUser } as never);
    const result = await getBankOrderView("not-a-uuid");
    expect(result).toMatchObject({ ok: false, code: "validation_failed" });
  });
});

// ─── Ownership ────────────────────────────────────────────────────────────────

describe("getBankOrderView — ownership", () => {
  it("returns not_found when the order belongs to another user", async () => {
    mockRequireActiveAccount.mockResolvedValue({ ok: true, user: fakeUser } as never);
    const db = makeDb({ orderRow: { id: fakeOrderId, user_id: otherUser.id, status: "pending_verification", payment_provider: "bank_transfer", order_number: fakeOrderNumber } });
    mockCreateClient.mockResolvedValue(db as never);
    const result = await getBankOrderView(fakeOrderId);
    expect(result).toMatchObject({ ok: false, code: "not_found" });
  });

  it("returns not_found when order does not exist", async () => {
    mockRequireActiveAccount.mockResolvedValue({ ok: true, user: fakeUser } as never);
    const db = makeDb({ orderError: { code: "PGRST116" } });
    mockCreateClient.mockResolvedValue(db as never);
    const result = await getBankOrderView(fakeOrderId);
    expect(result).toMatchObject({ ok: false, code: "not_found" });
  });

  it("returns not_found when payment_provider is not bank_transfer", async () => {
    mockRequireActiveAccount.mockResolvedValue({ ok: true, user: fakeUser } as never);
    const db = makeDb({ orderRow: { id: fakeOrderId, user_id: fakeUser.id, status: "pending_verification", payment_provider: "payhere", order_number: fakeOrderNumber } });
    mockCreateClient.mockResolvedValue(db as never);
    const result = await getBankOrderView(fakeOrderId);
    expect(result).toMatchObject({ ok: false, code: "not_found" });
  });
});

// ─── AC6: happy path — file key never returned ───────────────────────────────

describe("getBankOrderView — AC6: view shape", () => {
  it("returns order_number, bank_details, status, slips", async () => {
    mockRequireActiveAccount.mockResolvedValue({ ok: true, user: fakeUser } as never);
    const db = makeDb();
    mockCreateClient.mockResolvedValue(db as never);
    const result = await getBankOrderView(fakeOrderId);
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) throw new Error("expected ok");
    const view = result.data!;
    expect(view.orderNumber).toBe(fakeOrderNumber);
    expect(view.bankDetails).toBe("Account: 1234567890, Bank: BOC");
    expect(view.status).toBe("pending_verification");
    expect(view.slips).toHaveLength(1);
  });

  it("AC6: file_key is never present in any slip summary", async () => {
    mockRequireActiveAccount.mockResolvedValue({ ok: true, user: fakeUser } as never);
    const db = makeDb({ slipRows: [makeSlipRow(), makeSlipRow({ id: "slip-2", status: "rejected", rejection_reason: "wrong amount" })] });
    mockCreateClient.mockResolvedValue(db as never);
    const result = await getBankOrderView(fakeOrderId);
    if (!result.ok) throw new Error("expected ok");
    for (const slip of result.data!.slips) {
      expect(slip).not.toHaveProperty("file_key");
      expect(slip).not.toHaveProperty("fileKey");
    }
  });

  it("AC6: each slip has status, uploaded_at, rejection_reason only", async () => {
    mockRequireActiveAccount.mockResolvedValue({ ok: true, user: fakeUser } as never);
    const db = makeDb({ slipRows: [makeSlipRow({ status: "rejected", rejection_reason: "insufficient amount" })] });
    mockCreateClient.mockResolvedValue(db as never);
    const result = await getBankOrderView(fakeOrderId);
    if (!result.ok) throw new Error("expected ok");
    const slip = result.data!.slips[0]!;
    expect(slip.status).toBe("rejected");
    expect(slip.rejectionReason).toBe("insufficient amount");
    expect(slip.uploadedAt).toBeDefined();
  });

  it("EC6: returns empty bank_details when setting is missing", async () => {
    mockRequireActiveAccount.mockResolvedValue({ ok: true, user: fakeUser } as never);
    const db = makeDb({ noSetting: true });
    mockCreateClient.mockResolvedValue(db as never);
    const result = await getBankOrderView(fakeOrderId);
    if (!result.ok) throw new Error("expected ok");
    expect(result.data!.bankDetails).toBe("");
  });
});
