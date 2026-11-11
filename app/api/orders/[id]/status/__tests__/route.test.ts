import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/server", () => ({
  requireActiveAccount: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/ratelimit", () => ({
  checkRateLimit: vi.fn(),
}));

import { requireActiveAccount } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/ratelimit";
import { GET } from "@/app/api/orders/[id]/status/route";

const mockAuth = vi.mocked(requireActiveAccount);
const mockSupabase = vi.mocked(createSupabaseServerClient);
const mockRateLimit = vi.mocked(checkRateLimit);

const VALID_ORDER_ID = "550e8400-e29b-41d4-a716-446655440001";
const USER_ID = "550e8400-e29b-41d4-a716-446655440002";
const OTHER_USER_ID = "550e8400-e29b-41d4-a716-446655440003";

function makeRequest(orderId: string) {
  return new NextRequest(`http://localhost/api/orders/${orderId}/status`);
}

function makeParams(orderId: string) {
  return Promise.resolve({ id: orderId });
}

function mockSupabaseWithOrder(status: string | null, userId: string = USER_ID) {
  const single = vi.fn().mockResolvedValue(
    status !== null
      ? { data: { status, user_id: userId }, error: null }
      : { data: null, error: { code: "PGRST116" } }
  );
  const eq2 = vi.fn().mockReturnValue({ single });
  const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
  const select = vi.fn().mockReturnValue({ eq: eq1 });
  const from = vi.fn().mockReturnValue({ select });
  mockSupabase.mockResolvedValue({ from } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRateLimit.mockResolvedValue({ ok: true });
});

describe("GET /api/orders/[id]/status — authentication (AC6)", () => {
  it("returns 401 when unauthenticated (AC6)", async () => {
    mockAuth.mockResolvedValue({ ok: false, code: "not_allowed" } as never);
    const res = await GET(makeRequest(VALID_ORDER_ID), { params: makeParams(VALID_ORDER_ID) });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/orders/[id]/status — validation (AC8)", () => {
  it("returns 400 for a non-UUID order id (AC8)", async () => {
    mockAuth.mockResolvedValue({ ok: true, user: { id: USER_ID } } as never);
    const res = await GET(makeRequest("not-a-uuid"), { params: makeParams("not-a-uuid") });
    expect(res.status).toBe(400);
  });

  it("returns 400 for an order number format (EC3-gap)", async () => {
    mockAuth.mockResolvedValue({ ok: true, user: { id: USER_ID } } as never);
    const res = await GET(makeRequest("CS-2026-00001"), { params: makeParams("CS-2026-00001") });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/orders/[id]/status — rate limits (AC7)", () => {
  it("returns 429 when per-2s rate limit exceeded (AC7)", async () => {
    mockAuth.mockResolvedValue({ ok: true, user: { id: USER_ID } } as never);
    mockRateLimit.mockResolvedValueOnce({ ok: false, reason: "rate_limited", retryAfterSeconds: 2 });
    const res = await GET(makeRequest(VALID_ORDER_ID), { params: makeParams(VALID_ORDER_ID) });
    expect(res.status).toBe(429);
  });

  it("returns 429 when per-order total limit exceeded (AC7, EC5)", async () => {
    mockAuth.mockResolvedValue({ ok: true, user: { id: USER_ID } } as never);
    // First call (per-2s) passes, second call (per-40-total) fails
    mockRateLimit
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false, reason: "rate_limited", retryAfterSeconds: 86400 });
    const res = await GET(makeRequest(VALID_ORDER_ID), { params: makeParams(VALID_ORDER_ID) });
    expect(res.status).toBe(429);
  });
});

describe("GET /api/orders/[id]/status — happy path and ownership (AC6)", () => {
  it("returns 200 with status for the order owner (AC6)", async () => {
    mockAuth.mockResolvedValue({ ok: true, user: { id: USER_ID } } as never);
    mockSupabaseWithOrder("pending", USER_ID);
    const res = await GET(makeRequest(VALID_ORDER_ID), { params: makeParams(VALID_ORDER_ID) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("pending");
  });

  it("returns 200 with paid status (AC6)", async () => {
    mockAuth.mockResolvedValue({ ok: true, user: { id: USER_ID } } as never);
    mockSupabaseWithOrder("paid", USER_ID);
    const res = await GET(makeRequest(VALID_ORDER_ID), { params: makeParams(VALID_ORDER_ID) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("paid");
  });

  it("returns 404 when order not found (AC6)", async () => {
    mockAuth.mockResolvedValue({ ok: true, user: { id: USER_ID } } as never);
    mockSupabaseWithOrder(null);
    const res = await GET(makeRequest(VALID_ORDER_ID), { params: makeParams(VALID_ORDER_ID) });
    expect(res.status).toBe(404);
  });

  it("returns 404 when order belongs to another user — does not leak existence (EC4)", async () => {
    mockAuth.mockResolvedValue({ ok: true, user: { id: OTHER_USER_ID } } as never);
    // DB query filters by both id AND user_id, so returns nothing for wrong user
    mockSupabaseWithOrder(null);
    const res = await GET(makeRequest(VALID_ORDER_ID), { params: makeParams(VALID_ORDER_ID) });
    expect(res.status).toBe(404);
  });

  it("sets Cache-Control: no-store on 200 response (AC6)", async () => {
    mockAuth.mockResolvedValue({ ok: true, user: { id: USER_ID } } as never);
    mockSupabaseWithOrder("pending", USER_ID);
    const res = await GET(makeRequest(VALID_ORDER_ID), { params: makeParams(VALID_ORDER_ID) });
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});
