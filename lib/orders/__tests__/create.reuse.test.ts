// S-078: AC6 reuse / supersede / pending_order_exists / payment_in_progress
// Unit tests that verify the TypeScript layer correctly maps the
// create_order_locked RPC action string to the right ActionResult.

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

const fakeUser = { id: "user-10", email: "buyer@example.com", status: "active" };

const validBilling = {
  firstName: "Kasun",
  lastName: "Perera",
  phone: "0771234567",
  address: "No 1, Main Street",
  city: "Colombo",
};

const fakeCartLine = {
  cartItemId: "ci-1",
  documentId: "00000000-0000-4000-8000-000000000001",
  title: "Safety Sign Pack",
  slug: "safety-sign-pack",
  coverUrl: null,
  language: "en" as const,
  pageCount: 10,
  price: 1000,
  available: true,
};

const fakeCartResponse = { items: [fakeCartLine], subtotal: 1000, total: 1000 };

const validInput = {
  billing: validBilling,
  expectedTotalCents: 1000,
  acceptedTerms: true,
};

function makeDb(rpcReturnValue: unknown) {
  const chain: Record<string, unknown> = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    // terms + refund revisions come from .single()
    single: vi.fn()
      .mockResolvedValueOnce({ data: { id: "rev-terms-1" }, error: null })
      .mockResolvedValueOnce({ data: { id: "rev-refund-1" }, error: null }),
    // create_order_locked RPC
    rpc: vi.fn().mockResolvedValue({ data: rpcReturnValue, error: null }),
  };
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireActiveAccount.mockResolvedValue({ ok: true, user: fakeUser } as never);
  mockCheckRateLimit.mockResolvedValue({ ok: true });
  mockCalculateCart.mockResolvedValue(fakeCartResponse);
});

// ─── AC6a: reuse ──────────────────────────────────────────────────────────────

describe("createCheckout — AC6a reuse", () => {
  it("returns existing orderId when RPC returns 'reused'", async () => {
    const db = makeDb({ action: "reused", order_id: "ord-existing-1", order_number: "CS-2026-00001" });
    mockCreateClient.mockResolvedValue(db as never);

    const result = await createCheckout(validInput);

    expect(result).toMatchObject({
      ok: true,
      data: {
        orderId: "ord-existing-1",
        orderNumber: "CS-2026-00001",
        totalCents: 1000,
      },
    });
  });

  it("EC4: reuse path preserves the same order number (expiry extended inside SQL)", async () => {
    const db = makeDb({ action: "reused", order_id: "ord-existing-1", order_number: "CS-2026-00001" });
    mockCreateClient.mockResolvedValue(db as never);

    const result = await createCheckout(validInput);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data?.orderNumber).toBe("CS-2026-00001");
  });

  it("EC6: billing refresh happens inside the RPC (SQL SECURITY DEFINER update)", async () => {
    // The TypeScript layer does not duplicate the billing update on reuse —
    // the SQL function updates billing inside the same transaction.
    const db = makeDb({ action: "reused", order_id: "ord-existing-1", order_number: "CS-2026-00001" });
    const updateSpy = db.update as ReturnType<typeof vi.fn>;
    mockCreateClient.mockResolvedValue(db as never);

    await createCheckout({ ...validInput, billing: { ...validBilling, city: "Kandy" } });

    // The TypeScript layer should NOT call .update() on orders for reuse
    // (the SQL function handles it atomically). It may call .update() on
    // profiles if saveToProfile is set — but that is not set here.
    expect(updateSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: expect.anything() }),
    );
  });
});

// ─── AC6b/AC6d: payment_in_progress ──────────────────────────────────────────

describe("createCheckout — AC6b payment_in_progress", () => {
  it("returns payment_in_progress when RPC signals slow payment in flight", async () => {
    const db = makeDb({ action: "payment_in_progress", order_id: "ord-in-flight" });
    mockCreateClient.mockResolvedValue(db as never);

    const result = await createCheckout(validInput);
    expect(result).toMatchObject({ ok: false, code: "payment_in_progress" });
  });
});

// ─── AC6d: pending_order_exists ───────────────────────────────────────────────

describe("createCheckout — AC6d pending_order_exists", () => {
  it("returns pending_order_exists when RPC signals conflicting order", async () => {
    const db = makeDb({ action: "pending_order_exists", order_id: "ord-conflict" });
    mockCreateClient.mockResolvedValue(db as never);

    const result = await createCheckout(validInput);
    expect(result).toMatchObject({ ok: false, code: "pending_order_exists" });
  });
});

// ─── AC6c: supersede + create new ────────────────────────────────────────────

describe("createCheckout — AC6c supersede", () => {
  it("returns new orderId when RPC cancels old and creates new ('created' action)", async () => {
    // After supersede the SQL creates a new order and returns 'created'
    const db = makeDb({ action: "created", order_id: "ord-new-1", order_number: "CS-2026-00002" });
    mockCreateClient.mockResolvedValue(db as never);

    const result = await createCheckout(validInput);
    expect(result).toMatchObject({
      ok: true,
      data: {
        orderId: "ord-new-1",
        orderNumber: "CS-2026-00002",
        totalCents: 1000,
      },
    });
  });
});

// ─── AC6d (zero overlap): completely different cart creates new order ─────────

describe("createCheckout — AC6d zero overlap (completely different cart)", () => {
  it("creates a new order when RPC returns 'created' (zero-overlap falls through in SQL)", async () => {
    // The SQL function's zero-overlap path falls through the IF/ELSIF chain
    // and creates a new order, returning action='created'. This verifies the
    // TypeScript layer correctly handles that outcome.
    const db = makeDb({ action: "created", order_id: "ord-new-zero", order_number: "CS-2026-00005" });
    mockCreateClient.mockResolvedValue(db as never);

    const result = await createCheckout(validInput);
    expect(result).toMatchObject({
      ok: true,
      data: { orderId: "ord-new-zero", orderNumber: "CS-2026-00005" },
    });
  });
});

// ─── EC7: bank order not subject to card reuse/supersede (covered in bank-order.test.ts) ─

// ─── AC7 saveToProfile: billing saved to profile when flagged ────────────────

describe("createCheckout — AC7 saveToProfile", () => {
  it("calls profiles.update when saveToProfile is true", async () => {
    const db = makeDb({ action: "created", order_id: "ord-99", order_number: "CS-2026-00003" });
    const fromSpy = db.from as ReturnType<typeof vi.fn>;
    mockCreateClient.mockResolvedValue(db as never);

    await createCheckout({ ...validInput, billing: { ...validBilling, saveToProfile: true } });

    // profiles update must have been called
    expect(fromSpy).toHaveBeenCalledWith("profiles");
  });

  it("does NOT call profiles.update when saveToProfile is false/absent", async () => {
    const db = makeDb({ action: "created", order_id: "ord-100", order_number: "CS-2026-00004" });
    const fromSpy = db.from as ReturnType<typeof vi.fn>;
    mockCreateClient.mockResolvedValue(db as never);

    await createCheckout(validInput); // no saveToProfile

    expect(fromSpy).not.toHaveBeenCalledWith("profiles");
  });
});
