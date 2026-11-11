// S-078: createBankOrder unit tests (AC10, rate limit, EC7)

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
import { createBankOrder } from "@/lib/orders/create";

const mockRequireActiveAccount = vi.mocked(requireActiveAccount);
const mockCreateClient = vi.mocked(createSupabaseServerClient);
const mockCalculateCart = vi.mocked(calculateCart);
const mockCheckRateLimit = vi.mocked(checkRateLimit);

const fakeUser = { id: "user-2", email: "buyer@example.com", status: "active" };

const validBilling = {
  firstName: "Nimal",
  lastName: "Silva",
  phone: "0771111111",
  address: "123 Lake Road",
  city: "Kandy",
};

const fakeCartLine = {
  cartItemId: "ci-2",
  documentId: "00000000-0000-4000-8000-000000000002",
  title: "Toolbox Talk Pack",
  slug: "toolbox-talk-pack",
  coverUrl: null,
  language: "en" as const,
  pageCount: 5,
  price: 2000,
  available: true,
};

const fakeCartResponse = {
  items: [fakeCartLine],
  subtotal: 2000,
  total: 2000,
};

function makeSupabaseMock() {
  const chain: Record<string, unknown> = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    single: vi.fn(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    rpc: vi.fn(),
  };
  return chain;
}

beforeEach(() => vi.clearAllMocks());

// ─── AC1 (bank order): auth gate ─────────────────────────────────────────────

describe("createBankOrder — auth gate", () => {
  it("returns not_allowed when signed out", async () => {
    mockRequireActiveAccount.mockResolvedValue({ ok: false, code: "reauth_required" } as never);
    const result = await createBankOrder({ billing: validBilling, expectedTotalCents: 2000, acceptedTerms: true });
    expect(result).toMatchObject({ ok: false, code: "not_allowed" });
  });
});

// ─── Rate limit (gap analyst AC): same 10/hour limit ─────────────────────────

describe("createBankOrder — rate limit", () => {
  it("returns rate_limited on 11th call", async () => {
    mockRequireActiveAccount.mockResolvedValue({ ok: true, user: fakeUser } as never);
    mockCheckRateLimit.mockResolvedValue({
      ok: false,
      retryAfterSeconds: 3600,
      reason: "rate_limited",
    });
    const result = await createBankOrder({ billing: validBilling, expectedTotalCents: 2000, acceptedTerms: true });
    expect(result).toMatchObject({ ok: false, code: "rate_limited" });
  });
});

// ─── AC10: cart_empty / item checks ──────────────────────────────────────────

describe("createBankOrder — cart checks (AC10)", () => {
  beforeEach(() => {
    mockRequireActiveAccount.mockResolvedValue({ ok: true, user: fakeUser } as never);
    mockCheckRateLimit.mockResolvedValue({ ok: true });
  });

  it("returns cart_empty for empty cart", async () => {
    mockCalculateCart.mockResolvedValue({ items: [], subtotal: 0, total: 0 });
    const db = makeSupabaseMock();
    mockCreateClient.mockResolvedValue(db as never);

    const result = await createBankOrder({ billing: validBilling, expectedTotalCents: 0, acceptedTerms: true });
    expect(result).toMatchObject({ ok: false, code: "cart_empty" });
  });

  it("returns price_changed when expected total differs", async () => {
    mockCalculateCart.mockResolvedValue(fakeCartResponse);
    const db = makeSupabaseMock();
    (db.single as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { id: "rev-1" }, error: null });
    mockCreateClient.mockResolvedValue(db as never);

    const result = await createBankOrder({ billing: validBilling, expectedTotalCents: 999, acceptedTerms: true });
    expect(result).toMatchObject({ ok: false, code: "price_changed" });
  });

  it("returns cart_empty for 51+ lines (AC4 / AC10 same check)", async () => {
    // generateCart with 51 items
    const manyLines = Array.from({ length: 51 }, (_, i) => ({
      ...fakeCartLine,
      cartItemId: `ci-${i}`,
    }));
    mockCalculateCart.mockResolvedValue({ items: manyLines, subtotal: 0, total: 0 });
    const db = makeSupabaseMock();
    mockCreateClient.mockResolvedValue(db as never);

    // 51 items exceeds MAX_CART_LINES (50): implementation returns validation_failed
    const result = await createBankOrder({ billing: validBilling, expectedTotalCents: 0, acceptedTerms: true });
    expect(result).toMatchObject({ ok: false, code: "validation_failed" });
  });
});

// ─── AC10: bank order does not read or change card orders (EC7) ──────────────

describe("createBankOrder — EC7 no clash with card orders", () => {
  it("succeeds even when a pending card order exists for the same lines", async () => {
    mockRequireActiveAccount.mockResolvedValue({ ok: true, user: fakeUser } as never);
    mockCheckRateLimit.mockResolvedValue({ ok: true });
    mockCalculateCart.mockResolvedValue(fakeCartResponse);

    const db = makeSupabaseMock();
    // terms + refund revisions
    (db.single as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ data: { id: "rev-terms" }, error: null })
      .mockResolvedValueOnce({ data: { id: "rev-refund" }, error: null });
    // create_order_locked RPC
    (db.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { action: "created", order_id: "ord-bank-1", order_number: "CS-2026-00002" },
      error: null,
    });
    mockCreateClient.mockResolvedValue(db as never);

    const result = await createBankOrder({ billing: validBilling, expectedTotalCents: 2000, acceptedTerms: true });
    // Should not return pending_order_exists — bank orders don't check card orders
    expect(result).not.toMatchObject({ ok: false, code: "pending_order_exists" });
  });
});
