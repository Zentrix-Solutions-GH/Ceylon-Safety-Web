// S-079 AC7: getMyOrder — owner check, items and entitlements

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));
vi.mock("@/lib/auth/server", () => ({ requireActiveAccount: vi.fn() }));

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireActiveAccount } from "@/lib/auth/server";
import { getMyOrder } from "@/lib/orders/read";

const mockAuth = vi.mocked(requireActiveAccount);
const mockCreateClient = vi.mocked(createSupabaseServerClient);

const VALID_UUID = "00000000-0000-4000-8000-000000000001";
const fakeUser = { id: "user-99", email: "buyer@example.com", status: "active" };

function makeDb(singleReturn: unknown) {
  const chain: Record<string, unknown> = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(singleReturn),
  };
  return chain;
}

const fakeOrderRow = {
  id: VALID_UUID,
  order_number: "CS-2026-00001",
  status: "pending",
  total_cents: 1000,
  created_at: "2026-11-01T10:00:00Z",
  order_items: [
    {
      id: "item-1",
      document_id: "doc-1",
      title_snapshot: "Safety Signs Pack",
      language: "en",
      line_total_cents: 1000,
      entitlements: null,
    },
  ],
};

const fakeOrderRowPaid = {
  ...fakeOrderRow,
  status: "paid",
  order_items: [
    {
      ...fakeOrderRow.order_items[0],
      entitlements: [{ id: "entitlement-1" }],
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ ok: true, user: fakeUser } as never);
});

describe("getMyOrder — AC7", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ ok: false, code: "not_allowed" } as never);

    const result = await getMyOrder(VALID_UUID);
    expect(result).toMatchObject({ ok: false, code: "not_allowed" });
  });

  it("returns 400 for an invalid UUID", async () => {
    const result = await getMyOrder("not-a-uuid");
    expect(result).toMatchObject({ ok: false, code: "validation_failed" });
  });

  it("returns order with items and null entitlement when pending", async () => {
    const db = makeDb({ data: fakeOrderRow, error: null });
    mockCreateClient.mockResolvedValue(db as never);

    const result = await getMyOrder(VALID_UUID);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data?.orderId).toBe(VALID_UUID);
    expect(result.data?.orderNumber).toBe("CS-2026-00001");
    expect(result.data?.status).toBe("pending");
    expect(result.data?.items).toHaveLength(1);
    expect(result.data?.items[0].entitlementId).toBeNull();
  });

  it("returns entitlementId when order is paid", async () => {
    const db = makeDb({ data: fakeOrderRowPaid, error: null });
    mockCreateClient.mockResolvedValue(db as never);

    const result = await getMyOrder(VALID_UUID);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data?.status).toBe("paid");
    expect(result.data?.items[0].entitlementId).toBe("entitlement-1");
  });

  it("AC7: returns not_found for another user's order (DB returns no row)", async () => {
    const db = makeDb({ data: null, error: { code: "PGRST116", message: "No rows" } });
    mockCreateClient.mockResolvedValue(db as never);

    const result = await getMyOrder(VALID_UUID);
    expect(result).toMatchObject({ ok: false, code: "not_found" });
  });

  it("AC7: user_id filter is applied to the DB query — owner check is in the query", async () => {
    // Uses a fresh spy so we can assert the second .eq() call carried the user_id.
    // If the user_id filter is ever removed from read.ts, this test will fail.
    const eqSpy = vi.fn().mockReturnThis();
    const db = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: eqSpy,
      single: vi.fn().mockResolvedValue({ data: fakeOrderRow, error: null }),
    };
    mockCreateClient.mockResolvedValue(db as never);

    await getMyOrder(VALID_UUID);

    expect(eqSpy).toHaveBeenCalledWith("user_id", fakeUser.id);
  });

  it("returns not_found when order does not exist at all", async () => {
    const db = makeDb({ data: null, error: { code: "PGRST116", message: "No rows" } });
    mockCreateClient.mockResolvedValue(db as never);

    const result = await getMyOrder("11111111-1111-4111-8111-111111111111");
    expect(result).toMatchObject({ ok: false, code: "not_found" });
  });
});
