// S-087: GET /api/invoice/[orderId] tests (AC7, EC6)
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({
  serverConfig: { supabaseServiceRoleKey: "srk", ipHashSecret: "test-secret" },
  r2Config: vi.fn(() => ({
    bucketPrivate: "test-private",
    accountId: "acct",
    accessKeyId: "key",
    secretAccessKey: "secret",
    publicMediaBaseUrl: "https://cdn.test",
  })),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
  createSupabaseServiceRoleClient: vi.fn(),
}));
vi.mock("@/lib/auth/server", () => ({
  requireUser: vi.fn(),
  requireStaff: vi.fn(),
}));
vi.mock("@/lib/r2/storage", () => ({ getObjectBytes: vi.fn() }));

import { NextRequest } from "next/server";
import { requireUser, requireStaff } from "@/lib/auth/server";
import { getObjectBytes } from "@/lib/r2/storage";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server";
import { GET } from "@/app/api/invoice/[orderId]/route";

const ORDER_ID = "00000000-0000-4000-8000-000000000001";
const USER_ID = "user-buyer-1";

const ACTIVE_USER = {
  id: USER_ID,
  email: "buyer@example.com",
  phone: null,
  claimedRole: "customer" as const,
  hasTotpEnrolled: false,
  hasAuthenticatorLevel: false,
  status: "active",
};

const STAFF_USER = {
  id: "staff-1",
  email: "staff@example.com",
  phone: null,
  claimedRole: "staff" as const,
  hasTotpEnrolled: false,
  hasAuthenticatorLevel: false,
  status: "active",
};

const FAKE_PDF = Buffer.from("%PDF-1.4 test");

function makeRequest(orderId = ORDER_ID): NextRequest {
  return new NextRequest(`http://localhost/api/invoice/${orderId}`, { method: "GET" });
}

/** Builds a mock Supabase client for the owner path.
 *  The route now does two separate queries:
 *  1. orders → verify ownership (maybeSingle)
 *  2. invoices → get pdf_key (maybeSingle)
 */
function makeOwnerSupabase(options: {
  orderRow?: { id: string } | null;    // null = order not found / not owned
  invoiceRow?: { id: string; pdf_key: string | null } | null;
} = {}) {
  const {
    orderRow = { id: ORDER_ID },
    invoiceRow = { id: "inv-1", pdf_key: `invoices/${ORDER_ID}.pdf` },
  } = options;

  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "orders") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: orderRow, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === "invoices") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: invoiceRow, error: null }),
            }),
          }),
        };
      }
      return { select: vi.fn().mockReturnThis() };
    }),
  };
}

/** Builds a mock Supabase client for the staff path (single invoices query). */
function makeStaffSupabase(invoiceRow: { id: string; pdf_key: string | null } | null = { id: "inv-1", pdf_key: `invoices/${ORDER_ID}.pdf` }) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: invoiceRow, error: null }),
        }),
      }),
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getObjectBytes).mockResolvedValue(FAKE_PDF);
});

describe("GET /api/invoice/[orderId]", () => {
  it("returns 400 for a non-UUID orderId", async () => {
    vi.mocked(requireUser).mockResolvedValue({ ok: true, user: ACTIVE_USER } as never);
    vi.mocked(requireStaff).mockResolvedValue({ ok: false, code: "not_found" } as never);
    const req = makeRequest("not-a-uuid");
    const res = await GET(req, { params: Promise.resolve({ orderId: "not-a-uuid" }) });
    expect(res.status).toBe(400);
  });

  it("AC7: returns 401 when not signed in", async () => {
    vi.mocked(requireUser).mockResolvedValue({ ok: false, code: "not_found" } as never);
    vi.mocked(requireStaff).mockResolvedValue({ ok: false, code: "not_found" } as never);
    const params = Promise.resolve({ orderId: ORDER_ID });
    const res = await GET(makeRequest(), { params });
    expect(res.status).toBe(401);
  });

  it("AC7: order owner receives the PDF with application/pdf content-type", async () => {
    vi.mocked(requireUser).mockResolvedValue({ ok: true, user: ACTIVE_USER } as never);
    vi.mocked(requireStaff).mockResolvedValue({ ok: false, code: "not_found" } as never);
    vi.mocked(createSupabaseServerClient).mockResolvedValue(makeOwnerSupabase() as never);
    const params = Promise.resolve({ orderId: ORDER_ID });
    const res = await GET(makeRequest(), { params });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("cache-control")).toContain("no-store");
  });

  it("AC7: staff with orders permission can download any order's invoice", async () => {
    vi.mocked(requireUser).mockResolvedValue({ ok: false, code: "not_found" } as never);
    vi.mocked(requireStaff).mockResolvedValue({ ok: true, user: STAFF_USER } as never);
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(makeStaffSupabase() as never);
    const params = Promise.resolve({ orderId: ORDER_ID });
    const res = await GET(makeRequest(), { params });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("cache-control")).toContain("no-store");
  });

  it("EC6: non-owner customer gets 404 when order does not belong to them", async () => {
    vi.mocked(requireUser).mockResolvedValue({ ok: true, user: { ...ACTIVE_USER, id: "other-user" } } as never);
    vi.mocked(requireStaff).mockResolvedValue({ ok: false, code: "not_found" } as never);
    // Order not found for other-user
    vi.mocked(createSupabaseServerClient).mockResolvedValue(makeOwnerSupabase({ orderRow: null }) as never);
    const params = Promise.resolve({ orderId: ORDER_ID });
    const res = await GET(makeRequest(), { params });
    expect(res.status).toBe(404);
  });

  it("EC6: non-owner gets 404 even when no invoice row exists yet (no IDOR disclosure)", async () => {
    // Key IDOR test: a non-owner probing another order must get 404, not 202.
    vi.mocked(requireUser).mockResolvedValue({ ok: true, user: { ...ACTIVE_USER, id: "other-user" } } as never);
    vi.mocked(requireStaff).mockResolvedValue({ ok: false, code: "not_found" } as never);
    vi.mocked(createSupabaseServerClient).mockResolvedValue(
      makeOwnerSupabase({ orderRow: null, invoiceRow: null }) as never
    );
    const params = Promise.resolve({ orderId: ORDER_ID });
    const res = await GET(makeRequest(), { params });
    expect(res.status).toBe(404);
  });

  it("AC7: owner gets being_prepared JSON when no invoice exists yet", async () => {
    vi.mocked(requireUser).mockResolvedValue({ ok: true, user: ACTIVE_USER } as never);
    vi.mocked(requireStaff).mockResolvedValue({ ok: false, code: "not_found" } as never);
    vi.mocked(createSupabaseServerClient).mockResolvedValue(
      makeOwnerSupabase({ orderRow: { id: ORDER_ID }, invoiceRow: null }) as never
    );
    const params = Promise.resolve({ orderId: ORDER_ID });
    const res = await GET(makeRequest(), { params });
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.status).toBe("being_prepared");
  });
});
