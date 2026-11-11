// S-075: Cart server actions unit tests.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
  createSupabaseServiceRoleClient: vi.fn(), // used by clearCartForOrder
}));
vi.mock("@/lib/auth/server", () => ({ getCurrentUser: vi.fn(), requireActiveAccount: vi.fn() }));

import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getCurrentUser, requireActiveAccount } from "@/lib/auth/server";
import { addToCart, removeFromCart, getCart, clearCartForOrder } from "@/lib/cart/index";

const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockRequireActiveAccount = vi.mocked(requireActiveAccount);
const mockCreateClient = vi.mocked(createSupabaseServerClient);
const mockServiceRoleClient = vi.mocked(createSupabaseServiceRoleClient);

function makeSupabaseMock(overrides: Record<string, unknown> = {}) {
  const base = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    single: vi.fn(),
    upsert: vi.fn().mockReturnThis(),
    ...overrides,
  };
  return base;
}

const fakeUser = { id: "user-1", email: "a@b.com", status: "active" };
const fakeDocId = "00000000-0000-4000-8000-000000000001";
const fakeDoc = {
  id: fakeDocId,
  status: "published",
  deleted_at: null,
};

beforeEach(() => vi.clearAllMocks());

// ─── addToCart ───────────────────────────────────────────────────────────────

describe("addToCart", () => {
  it("AC5/EC5: returns not_signed_in when no user", async () => {
    mockRequireActiveAccount.mockResolvedValue({ ok: false, code: "reauth_required" } as never);
    const result = await addToCart(fakeDocId, "en");
    expect(result).toEqual({ ok: false, code: "not_signed_in" });
  });

  it("S17: returns not_allowed for suspended user", async () => {
    mockRequireActiveAccount.mockResolvedValue({ ok: false, code: "account_suspended" } as never);
    const result = await addToCart(fakeDocId, "en");
    expect(result).toEqual({ ok: false, code: "not_allowed" });
  });

  it("AC1/EC1: returns document_unavailable for deleted document", async () => {
    mockRequireActiveAccount.mockResolvedValue({ ok: true, user: fakeUser } as never);
    const docSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const sb = { from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ is: vi.fn().mockReturnValue({ single: docSingle }) }) }) }) };
    mockCreateClient.mockResolvedValue(sb as never);
    const result = await addToCart("00000000-0000-4000-8000-000000000002", "en");
    expect(result).toEqual({ ok: false, code: "document_unavailable" });
  });

  it("AC1/EC1: returns document_unavailable for unpublished document", async () => {
    mockRequireActiveAccount.mockResolvedValue({ ok: true, user: fakeUser } as never);
    const docSingle = vi.fn().mockResolvedValue({ data: { ...fakeDoc, status: "draft" }, error: null });
    const sb = { from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ is: vi.fn().mockReturnValue({ single: docSingle }) }) }) }) };
    mockCreateClient.mockResolvedValue(sb as never);
    const result = await addToCart("00000000-0000-4000-8000-000000000003", "en");
    expect(result).toEqual({ ok: false, code: "document_unavailable" });
  });

  it("AC1: returns validation_failed for invalid language", async () => {
    mockRequireActiveAccount.mockResolvedValue({ ok: true, user: fakeUser } as never);
    const result = await addToCart(fakeDocId, "fr" as never);
    expect(result).toEqual({ ok: false, code: "validation_failed" });
  });

  it("AC7/EC3: returns already_in_cart for duplicate (unique constraint violation)", async () => {
    mockRequireActiveAccount.mockResolvedValue({ ok: true, user: fakeUser } as never);
    const docSingle = vi.fn().mockResolvedValue({ data: fakeDoc, error: null });
    const sb = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "documents") return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ is: vi.fn().mockReturnValue({ single: docSingle }) }) }) };
        if (table === "cart_items") return {
          select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ count: 2, error: null }) }),
          insert: vi.fn().mockResolvedValue({ data: null, error: { code: "23505", message: "duplicate" } }),
        };
        return { upsert: vi.fn().mockResolvedValue({ error: null }) };
      }),
    };
    mockCreateClient.mockResolvedValue(sb as never);
    const result = await addToCart(fakeDocId, "en");
    expect(result).toEqual({ ok: false, code: "already_in_cart" });
  });

  it("AC5/EC4: returns cart_full when cart has 50 items", async () => {
    mockRequireActiveAccount.mockResolvedValue({ ok: true, user: fakeUser } as never);
    const docSingle = vi.fn().mockResolvedValue({ data: fakeDoc, error: null });
    const sb = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "documents") return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ is: vi.fn().mockReturnValue({ single: docSingle }) }) }) };
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ count: 50, error: null }) }) };
      }),
    };
    mockCreateClient.mockResolvedValue(sb as never);
    const result = await addToCart(fakeDocId, "si");
    expect(result).toEqual({ ok: false, code: "cart_full" });
  });

  it("EC4: returns cart_full when DB trigger fires P0001 (concurrent race safety net)", async () => {
    mockRequireActiveAccount.mockResolvedValue({ ok: true, user: fakeUser } as never);
    const docSingle = vi.fn().mockResolvedValue({ data: fakeDoc, error: null });
    const sb = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "documents") return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ is: vi.fn().mockReturnValue({ single: docSingle }) }) }) };
        if (table === "cart_items") return {
          select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ count: 2, error: null }) }),
          insert: vi.fn().mockResolvedValue({ error: { code: "P0001", message: "cart_full" } }),
        };
        return { upsert: vi.fn().mockResolvedValue({ error: null }) };
      }),
    };
    mockCreateClient.mockResolvedValue(sb as never);
    const result = await addToCart(fakeDocId, "en");
    expect(result).toEqual({ ok: false, code: "cart_full" });
  });

  it("AC1: happy path inserts row and returns ok", async () => {
    mockRequireActiveAccount.mockResolvedValue({ ok: true, user: fakeUser } as never);
    const docSingle = vi.fn().mockResolvedValue({ data: fakeDoc, error: null });
    const sb = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "documents") return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ is: vi.fn().mockReturnValue({ single: docSingle }) }) }) };
        if (table === "cart_items") return {
          select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ count: 2, error: null }) }),
          insert: vi.fn().mockResolvedValue({ data: { id: "item-1" }, error: null }),
        };
        return { upsert: vi.fn().mockResolvedValue({ error: null }) };
      }),
    };
    mockCreateClient.mockResolvedValue(sb as never);
    const result = await addToCart(fakeDocId, "en");
    expect(result).toEqual({ ok: true });
  });
});

// ─── removeFromCart ──────────────────────────────────────────────────────────

describe("removeFromCart", () => {
  it("AC2: happy path removes own item", async () => {
    mockRequireActiveAccount.mockResolvedValue({ ok: true, user: fakeUser } as never);
    const sb = makeSupabaseMock();
    // select returns the item (ownership confirmed), delete succeeds
    sb.from = vi.fn().mockImplementation((table: string) => {
      if (table === "cart_items") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: "item-1" }, error: null }),
              }),
            }),
          }),
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
        };
      }
      return makeSupabaseMock();
    });
    mockCreateClient.mockResolvedValue(sb as never);

    const result = await removeFromCart("item-1");
    expect(result).toEqual({ ok: true });
  });

  it("AC2/EC6: returns not_found for another user's item (select returns null)", async () => {
    mockRequireActiveAccount.mockResolvedValue({ ok: true, user: fakeUser } as never);
    const sb = makeSupabaseMock();
    sb.from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    });
    mockCreateClient.mockResolvedValue(sb as never);

    const result = await removeFromCart("item-other");
    expect(result).toEqual({ ok: false, code: "not_found" });
  });

  it("EC5: returns not_signed_in when no user", async () => {
    mockRequireActiveAccount.mockResolvedValue({ ok: false, code: "reauth_required" } as never);
    const result = await removeFromCart("item-1");
    expect(result).toEqual({ ok: false, code: "not_signed_in" });
  });

  it("S17: returns not_allowed for suspended user", async () => {
    mockRequireActiveAccount.mockResolvedValue({ ok: false, code: "account_suspended" } as never);
    const result = await removeFromCart("item-1");
    expect(result).toEqual({ ok: false, code: "not_allowed" });
  });
});

// ─── getCart ─────────────────────────────────────────────────────────────────

describe("getCart", () => {
  it("AC3/AC6: returns empty array for unauthenticated caller", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const result = await getCart();
    expect(result).toEqual({ ok: true, items: [] });
  });

  it("AC3: returns cart items for signed-in user", async () => {
    mockGetCurrentUser.mockResolvedValue(fakeUser as never);
    const sb = makeSupabaseMock();
    const rows = [
      { id: "item-1", document_id: fakeDocId, language: "en", created_at: "2026-01-01" },
    ];
    sb.eq = vi.fn().mockResolvedValue({ data: rows, error: null });
    mockCreateClient.mockResolvedValue(sb as never);

    const result = await getCart();
    expect(result).toEqual({
      ok: true,
      items: [{ id: "item-1", documentId: fakeDocId, language: "en", addedAt: "2026-01-01" }],
    });
  });
});

// ─── clearCartForOrder ───────────────────────────────────────────────────────

describe("clearCartForOrder", () => {
  it("AC8: removes cart_items using a single batch delete scoped to user_id (uses service-role client)", async () => {
    const mockOr = vi.fn().mockResolvedValue({ error: null });
    const mockEq = vi.fn().mockReturnValue({ or: mockOr });
    const mockDelete = vi.fn().mockReturnValue({ eq: mockEq });

    const sb = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "order_items") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  { document_id: "00000000-0000-4000-8000-000000000001", language: "en" },
                  { document_id: "00000000-0000-4000-8000-000000000002", language: "si" },
                ],
                error: null,
              }),
            }),
          };
        }
        return { delete: mockDelete };
      }),
    };
    mockServiceRoleClient.mockReturnValue(sb as never);

    await expect(clearCartForOrder("order-1", "user-1")).resolves.toBeUndefined();
    expect(mockServiceRoleClient).toHaveBeenCalled();
    expect(mockDelete).toHaveBeenCalled();
    // Verify user_id scoping
    expect(mockEq).toHaveBeenCalledWith("user_id", "user-1");
    // Verify single OR batch (not N individual deletes)
    expect(mockOr).toHaveBeenCalledTimes(1);
    expect(mockOr).toHaveBeenCalledWith(
      "and(document_id.eq.00000000-0000-4000-8000-000000000001,language.eq.en),and(document_id.eq.00000000-0000-4000-8000-000000000002,language.eq.si)",
    );
  });

  it("AC8: no-ops when order has no items", async () => {
    const sb = {
      from: vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      })),
    };
    mockServiceRoleClient.mockReturnValue(sb as never);

    await expect(clearCartForOrder("order-empty", "user-1")).resolves.toBeUndefined();
  });
});
