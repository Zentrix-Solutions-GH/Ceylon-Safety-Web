// S-084: HTTP route tests for GET /api/bank-slip/[slipId] — AC2

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({
  serverConfig: { supabaseServiceRoleKey: "srk" },
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
}));
vi.mock("@/lib/auth/server", () => ({ requireStaff: vi.fn() }));
vi.mock("@/lib/r2/storage", () => ({ presignedGet: vi.fn() }));

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/server";
import { presignedGet } from "@/lib/r2/storage";
import { GET } from "@/app/api/bank-slip/[slipId]/route";

const VALID_SLIP_ID = "00000000-0000-4000-8000-000000000011";
const SIGNED_URL = "https://r2.example.com/signed/slips/test.jpg?X-Sig=abc";

const STAFF = {
  id: "staff-01",
  email: "staff@example.com",
  claimedRole: "admin" as const,
  hasTotpEnrolled: true,
  hasAuthenticatorLevel: true,
};

function makeDb(slipData: unknown | null = { id: VALID_SLIP_ID, file_key: "slips/test.jpg" }) {
  return {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue(
        slipData ? { data: slipData, error: null } : { data: null, error: { message: "not found" } }
      ),
    })),
  };
}

function makeRequest(slipId: string) {
  return new Request(`http://localhost/api/bank-slip/${slipId}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(presignedGet).mockResolvedValue(SIGNED_URL);
});

// ─── AC2: 403 wrong role ──────────────────────────────────────────────────────

describe("GET /api/bank-slip/[slipId] — AC2 permission", () => {
  it("returns 403 when requireStaff fails (not_allowed)", async () => {
    vi.mocked(requireStaff).mockResolvedValue({ ok: false, code: "not_allowed" } as never);

    const res = await GET(makeRequest(VALID_SLIP_ID), { params: Promise.resolve({ slipId: VALID_SLIP_ID }) });

    expect(res.status).toBe(403);
    expect(vi.mocked(requireStaff)).toHaveBeenCalledWith("bank_transfers.review");
  });

  it("requires the bank_transfers.review permission specifically", async () => {
    vi.mocked(requireStaff).mockResolvedValue({ ok: false, code: "not_allowed" } as never);

    await GET(makeRequest(VALID_SLIP_ID), { params: Promise.resolve({ slipId: VALID_SLIP_ID }) });

    expect(vi.mocked(requireStaff)).toHaveBeenCalledWith("bank_transfers.review");
  });
});

// ─── AC2: 400 bad UUID ────────────────────────────────────────────────────────

describe("GET /api/bank-slip/[slipId] — AC2 input validation", () => {
  it("returns 400 when slipId is not a UUID", async () => {
    vi.mocked(requireStaff).mockResolvedValue({ ok: true, user: STAFF } as never);

    const res = await GET(makeRequest("not-a-uuid"), { params: Promise.resolve({ slipId: "not-a-uuid" }) });

    expect(res.status).toBe(400);
  });
});

// ─── AC2: 404 slip not found ──────────────────────────────────────────────────

describe("GET /api/bank-slip/[slipId] — AC2 slip not found", () => {
  it("returns 404 when slip does not exist", async () => {
    vi.mocked(requireStaff).mockResolvedValue({ ok: true, user: STAFF } as never);
    vi.mocked(createSupabaseServerClient).mockResolvedValue(makeDb(null) as never);

    const res = await GET(makeRequest(VALID_SLIP_ID), { params: Promise.resolve({ slipId: VALID_SLIP_ID }) });

    expect(res.status).toBe(404);
  });
});

// ─── AC2: 200 success — no-store, correct body, no file_key ──────────────────

describe("GET /api/bank-slip/[slipId] — AC2 success", () => {
  it("returns 200 with signed url and expiresInSeconds", async () => {
    vi.mocked(requireStaff).mockResolvedValue({ ok: true, user: STAFF } as never);
    vi.mocked(createSupabaseServerClient).mockResolvedValue(makeDb() as never);

    const res = await GET(makeRequest(VALID_SLIP_ID), { params: Promise.resolve({ slipId: VALID_SLIP_ID }) });

    expect(res.status).toBe(200);
    const body = await res.json() as { url: string; expiresInSeconds: number; file_key?: string };
    expect(body.url).toBe(SIGNED_URL);
    expect(body.expiresInSeconds).toBe(60);
  });

  it("sets Cache-Control: no-store (AC2)", async () => {
    vi.mocked(requireStaff).mockResolvedValue({ ok: true, user: STAFF } as never);
    vi.mocked(createSupabaseServerClient).mockResolvedValue(makeDb() as never);

    const res = await GET(makeRequest(VALID_SLIP_ID), { params: Promise.resolve({ slipId: VALID_SLIP_ID }) });

    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("does NOT expose file_key in the response body (S13)", async () => {
    vi.mocked(requireStaff).mockResolvedValue({ ok: true, user: STAFF } as never);
    vi.mocked(createSupabaseServerClient).mockResolvedValue(makeDb() as never);

    const res = await GET(makeRequest(VALID_SLIP_ID), { params: Promise.resolve({ slipId: VALID_SLIP_ID }) });

    const body = await res.json() as Record<string, unknown>;
    expect(body).not.toHaveProperty("file_key");
  });
});
