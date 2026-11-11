// S-078 — AC5: advisory lock / concurrency guarantee.
//
// Full concurrency testing (two simultaneous connections racing to create an
// order) requires a live Supabase instance and is verified manually during
// staging:
//
//   1. supabase start
//   2. Run two concurrent createCheckout calls for the same user + same cart.
//   3. Expect exactly one order row in `orders` table.
//
// The unit tests below verify the TypeScript layer's behaviour when the
// `create_order_locked` RPC signals that a concurrent call already created an
// order (i.e. the second caller gets "reused" back from the DB function).
// The advisory lock itself is in the SQL migration; these tests confirm the
// TypeScript correctly handles every RPC action string without branching on
// race-condition outcomes in application code.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));
vi.mock("@/lib/auth/server", () => ({ requireActiveAccount: vi.fn() }));
vi.mock("@/lib/cart/calculate", () => ({ calculateCart: vi.fn() }));
vi.mock("@/lib/ratelimit", () => ({ checkRateLimit: vi.fn() }));

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireActiveAccount } from "@/lib/auth/server";
import { calculateCart } from "@/lib/cart/calculate";
import { checkRateLimit } from "@/lib/ratelimit";
import { createCheckout } from "@/lib/orders/create";

const mockRequireActiveAccount = vi.mocked(requireActiveAccount);
const mockCreateClient = vi.mocked(createSupabaseServerClient);
const mockCalculateCart = vi.mocked(calculateCart);
const mockCheckRateLimit = vi.mocked(checkRateLimit);

const fakeUser = { id: "user-20", email: "concurrent@example.com", status: "active" };
const validBilling = {
  firstName: "Kasun", lastName: "Perera", phone: "0771234567",
  address: "No 1, Main Street", city: "Colombo",
};
const fakeCartLine = {
  cartItemId: "ci-1", documentId: "00000000-0000-4000-8000-000000000001",
  title: "Safety Sign Pack", slug: "safety-sign-pack",
  coverUrl: null, language: "en" as const, pageCount: 10, price: 1000, available: true,
};
const validInput = { billing: validBilling, expectedTotalCents: 1000, acceptedTerms: true };

function makeDb(rpcReturnValue: unknown) {
  return {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn()
      .mockResolvedValueOnce({ data: { id: "rev-terms" }, error: null })
      .mockResolvedValueOnce({ data: { id: "rev-refund" }, error: null }),
    rpc: vi.fn().mockResolvedValue({ data: rpcReturnValue, error: null }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireActiveAccount.mockResolvedValue({ ok: true, user: fakeUser } as never);
  mockCheckRateLimit.mockResolvedValue({ ok: true });
  mockCalculateCart.mockResolvedValue({ items: [fakeCartLine], subtotal: 1000, total: 1000 });
});

// ─── AC5: concurrent calls produce one order ──────────────────────────────────

describe("createCheckout — AC5 advisory lock / concurrency", () => {
  it("EC5: second concurrent call gets 'reused' action and returns the same orderId", async () => {
    // Simulate: first call creates the order (action='created').
    // Second call (same user, same cart, within lock window) gets 'reused'.
    // The advisory lock in create_order_locked ensures only one INSERT happens.
    const db1 = makeDb({ action: "created", order_id: "ord-lock-1", order_number: "CS-2026-00001" });
    mockCreateClient.mockResolvedValue(db1 as never);
    const result1 = await createCheckout(validInput);

    expect(result1).toMatchObject({
      ok: true,
      data: { orderId: "ord-lock-1", orderNumber: "CS-2026-00001", totalCents: 1000 },
    });

    // Second call: RPC returns 'reused' (same order, no duplicate INSERT)
    vi.clearAllMocks();
    mockRequireActiveAccount.mockResolvedValue({ ok: true, user: fakeUser } as never);
    mockCheckRateLimit.mockResolvedValue({ ok: true });
    mockCalculateCart.mockResolvedValue({ items: [fakeCartLine], subtotal: 1000, total: 1000 });

    const db2 = makeDb({ action: "reused", order_id: "ord-lock-1", order_number: "CS-2026-00001" });
    mockCreateClient.mockResolvedValue(db2 as never);
    const result2 = await createCheckout(validInput);

    expect(result2).toMatchObject({
      ok: true,
      data: { orderId: "ord-lock-1", orderNumber: "CS-2026-00001", totalCents: 1000 },
    });

    // Both results point to the same order
    expect(result1.ok).toBe(true);
    expect(result2.ok).toBe(true);
    if (!result1.ok || !result2.ok) return;
    expect(result1.data?.orderId).toBe(result2.data?.orderId);
  });

  it("advisory lock RPC is always called with the authenticated user's id (never client-supplied)", async () => {
    const db = makeDb({ action: "created", order_id: "ord-99", order_number: "CS-2026-00001" });
    const rpcSpy = db.rpc as ReturnType<typeof vi.fn>;
    mockCreateClient.mockResolvedValue(db as never);

    await createCheckout(validInput);

    // The first positional arg to rpc must be the function name;
    // p_user_id in the args must equal fakeUser.id from requireActiveAccount()
    expect(rpcSpy).toHaveBeenCalledWith(
      "create_order_locked",
      expect.objectContaining({ p_user_id: fakeUser.id }),
    );
  });
});
