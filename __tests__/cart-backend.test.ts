// S-075: Cart server actions unit tests.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
  createSupabaseServiceRoleClient: vi.fn(), // used by clearCartForOrder
}));
vi.mock("@/lib/auth/server", () => ({ getCurrentUser: vi.fn() }));

import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/server";
import { addToCart, removeFromCart, getCart, clearCartForOrder } from "@/lib/cart/index";

const mockGetCurrentUser = vi.mocked(getCurrentUser);
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
const fakeDoc = {
  id: "doc-1",
  status: "published",
  deleted_at: null,
};

beforeEach(() => vi.clearAllMocks());

// ─── addToCart ───────────────────────────────────────────────────────────────

describe("addToCart", () => {
  it("AC5/EC5: returns not_signed_in when no user", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const result = await addToCart("doc-1", "en");
    expect(result).toEqual({ ok: false, code: "not_signed_in" });
  });

  it("AC1/EC1: returns document_unavailable for deleted document", async () => {
    mockGetCurrentUser.mockResolvedValue(fakeUser as never);
    const sb = makeSupabaseMock();
    // Document lookup returns null (deleted or not found)
    sb.single.mockResolvedValueOnce({ data: null, error: null });
    mockCreateClient.mockResolvedValue(sb as never);

    const result = await addToCart("doc-deleted", "en");
    expect(result).toEqual({ ok: false, code: "document_unavailable" });
  });

  it("AC1/EC1: returns document_unavailable for unpublished document", async () => {
    mockGetCurrentUser.mockResolvedValue(fakeUser as never);
    const sb = makeSupabaseMock();
    sb.single.mockResolvedValueOnce({ data: { ...fakeDoc, status: "draft" }, error: null });
    mockCreateClient.mockResolvedValue(sb as never);

    const result = await addToCart("doc-draft", "en");
    expect(result).toEqual({ ok: false, code: "document_unavailable" });
  });

  it("AC1: returns validation_failed for invalid language", async () => {
    mockGetCurrentUser.mockResolvedValue(fakeUser as never);
    const result = await addToCart("doc-1", "fr" as never);
    expect(result).toEqual({ ok: false, code: "validation_failed" });
  });

  it("AC7/EC3: returns already_in_cart for duplicate (unique constraint violation)", async () => {
    mockGetCurrentUser.mockResolvedValue(fakeUser as never);
    const sb = makeSupabaseMock();
    // Document found and published
    sb.single.mockResolvedValueOnce({ data: fakeDoc, error: null });
    // Count = 2 (not full)
    sb.single.mockResolvedValueOnce({ data: { count: 2 }, error: null });
    // Insert conflict
    sb.single.mockResolvedValueOnce({
      data: null,
      error: { code: "23505", message: "duplicate" },
    });
    mockCreateClient.mockResolvedValue(sb as never);

    const result = await addToCart("doc-1", "en");
    expect(result).toEqual({ ok: false, code: "already_in_cart" });
  });

  it("AC5/EC4: returns cart_full when cart has 50 items", async () => {
    mockGetCurrentUser.mockResolvedValue(fakeUser as never);
    const sb = makeSupabaseMock();
    sb.single.mockResolvedValueOnce({ data: fakeDoc, error: null });
    // Count = 50
    sb.single.mockResolvedValueOnce({ data: { count: 50 }, error: null });
    mockCreateClient.mockResolvedValue(sb as never);

    const result = await addToCart("doc-1", "si");
    expect(result).toEqual({ ok: false, code: "cart_full" });
  });

  it("AC1: happy path inserts row and returns ok", async () => {
    mockGetCurrentUser.mockResolvedValue(fakeUser as never);
    const sb = makeSupabaseMock();
    sb.single.mockResolvedValueOnce({ data: fakeDoc, error: null });
    sb.single.mockResolvedValueOnce({ data: { count: 2 }, error: null });
    sb.single.mockResolvedValueOnce({
      data: { id: "item-1", document_id: "doc-1", language: "en", created_at: "2026-01-01" },
      error: null,
    });
    mockCreateClient.mockResolvedValue(sb as never);

    const result = await addToCart("doc-1", "en");
    expect(result).toEqual({ ok: true });
  });
});

// ─── removeFromCart ──────────────────────────────────────────────────────────

describe("removeFromCart", () => {
  it("AC2: happy path removes own item", async () => {
    mockGetCurrentUser.mockResolvedValue(fakeUser as never);
    const sb = makeSupabaseMock();
    // delete matched 1 row
    const mockDelete = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [{ id: "item-1" }], error: null, count: 1 }),
      }),
    });
    sb.from = vi.fn().mockReturnValue({ delete: mockDelete });
    mockCreateClient.mockResolvedValue(sb as never);

    const result = await removeFromCart("item-1");
    expect(result).toEqual({ ok: true });
  });

  it("AC2/EC6: returns not_found for another user's item (no rows deleted)", async () => {
    mockGetCurrentUser.mockResolvedValue(fakeUser as never);
    const sb = makeSupabaseMock();
    const mockDelete = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
      }),
    });
    sb.from = vi.fn().mockReturnValue({ delete: mockDelete });
    mockCreateClient.mockResolvedValue(sb as never);

    const result = await removeFromCart("item-other");
    expect(result).toEqual({ ok: false, code: "not_found" });
  });

  it("EC5: returns not_signed_in when no user", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const result = await removeFromCart("item-1");
    expect(result).toEqual({ ok: false, code: "not_signed_in" });
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
      { id: "item-1", document_id: "doc-1", language: "en", created_at: "2026-01-01" },
    ];
    sb.eq = vi.fn().mockResolvedValue({ data: rows, error: null });
    mockCreateClient.mockResolvedValue(sb as never);

    const result = await getCart();
    expect(result).toEqual({
      ok: true,
      items: [{ id: "item-1", documentId: "doc-1", language: "en", addedAt: "2026-01-01" }],
    });
  });
});

// ─── clearCartForOrder ───────────────────────────────────────────────────────

describe("clearCartForOrder", () => {
  it("AC8: removes cart_items matching the given order's lines (uses service-role client)", async () => {
    const finalEq = vi.fn().mockResolvedValue({ error: null });
    const secondEq = vi.fn().mockReturnValue({ eq: finalEq });
    const firstEq = vi.fn().mockReturnValue({ eq: secondEq });
    const mockDelete = vi.fn().mockReturnValue({ eq: firstEq });

    const sb = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "order_items") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{ document_id: "doc-1", language: "en" }],
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
    // Verify user_id is passed as first .eq argument (ownership scope)
    expect(firstEq).toHaveBeenCalledWith("user_id", "user-1");
  });
});
