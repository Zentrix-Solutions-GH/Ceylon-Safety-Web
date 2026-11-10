// S-075: POST /api/cart/calculate unit tests.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/cart/calculate", () => ({ calculateCart: vi.fn() }));
vi.mock("@/lib/auth/server", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/ratelimit/index", () => ({ checkRateLimit: vi.fn() }));

import { calculateCart } from "@/lib/cart/calculate";
import { getCurrentUser } from "@/lib/auth/server";
import { checkRateLimit } from "@/lib/ratelimit/index";
import { POST } from "@/app/api/cart/calculate/route";

const mockCalculateCart = vi.mocked(calculateCart);
const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockCheckRateLimit = vi.mocked(checkRateLimit);

const fakeUser = { id: "user-1", email: "a@b.com", status: "active" };

const fakeResponse = {
  items: [
    {
      cartItemId: "item-1",
      title: "Safety Sign EN",
      slug: "safety-sign",
      coverUrl: null,
      language: "en" as const,
      pageCount: 10,
      price: 2500,
      available: true,
    },
  ],
  subtotal: 2500,
  total: 2500,
};

function makeRequest(body: unknown = {}) {
  return new NextRequest("http://localhost/api/cart/calculate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => vi.clearAllMocks());

describe("POST /api/cart/calculate", () => {
  it("AC4: returns 401 when unauthenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it("AC4: returns 429 when rate limited", async () => {
    mockGetCurrentUser.mockResolvedValue(fakeUser as never);
    mockCheckRateLimit.mockResolvedValue({ ok: false, reason: "rate_limited", retryAfterSeconds: 10 });
    const res = await POST(makeRequest());
    expect(res.status).toBe(429);
  });

  it("AC5: returns 422 when stored cart exceeds 50 lines", async () => {
    mockGetCurrentUser.mockResolvedValue(fakeUser as never);
    mockCheckRateLimit.mockResolvedValue({ ok: true });
    // Simulate calculateCart returning 51 items
    const oversized = Array.from({ length: 51 }, (_, i) => ({
      cartItemId: `item-${i}`,
      title: `Doc ${i}`,
      slug: `doc-${i}`,
      coverUrl: null,
      language: "en" as const,
      pageCount: null,
      price: 100,
      available: true,
    }));
    mockCalculateCart.mockResolvedValue({ items: oversized, subtotal: 5100, total: 5100 });
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(422);
  });

  it("AC4: happy path prices items and returns 200", async () => {
    mockGetCurrentUser.mockResolvedValue(fakeUser as never);
    mockCheckRateLimit.mockResolvedValue({ ok: true });
    mockCalculateCart.mockResolvedValue(fakeResponse);

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.subtotal).toBe(2500);
    expect(body.total).toBe(2500);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].available).toBe(true);
  });

  it("AC4: marks unavailable item when calculateCart returns available:false", async () => {
    mockGetCurrentUser.mockResolvedValue(fakeUser as never);
    mockCheckRateLimit.mockResolvedValue({ ok: true });
    mockCalculateCart.mockResolvedValue({
      items: [
        {
          cartItemId: "item-1",
          title: "Old Doc",
          slug: "old-doc",
          coverUrl: null,
          language: "en" as const,
          pageCount: null,
          price: 0,
          available: false,
          unavailableReason: "document_unavailable" as const,
        },
      ],
      subtotal: 0,
      total: 0,
    });

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items[0].available).toBe(false);
    expect(body.items[0].unavailableReason).toBe("document_unavailable");
  });

  it("AC4: empty cart returns 200 with empty items", async () => {
    mockGetCurrentUser.mockResolvedValue(fakeUser as never);
    mockCheckRateLimit.mockResolvedValue({ ok: true });
    mockCalculateCart.mockResolvedValue({ items: [], subtotal: 0, total: 0 });

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(0);
    expect(body.total).toBe(0);
  });
});
