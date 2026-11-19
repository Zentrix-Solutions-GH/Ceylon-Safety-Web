// S-085: AC1 — GET refused (405); POST needs sign-in; suspended account refused.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({
  serverConfig: { supabaseServiceRoleKey: "srk", ipHashSecret: "test-ip-hash-secret" },
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
vi.mock("@/lib/auth/server", () => ({ requireActiveAccount: vi.fn() }));
vi.mock("@/lib/ratelimit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/downloads/claim", () => ({ claimDownload: vi.fn() }));

import { NextRequest } from "next/server";
import { requireActiveAccount } from "@/lib/auth/server";
import { checkRateLimit } from "@/lib/ratelimit";
import { claimDownload } from "@/lib/downloads/claim";
import { GET, POST } from "@/app/api/download/[entitlementId]/route";

const ENT_ID = "00000000-0000-4000-8000-000000000001";
const USER_ID = "user-buyer-1";

const ACTIVE_USER = {
  id: USER_ID,
  email: "buyer@example.com",
  phone: null,
  claimedRole: "customer" as const,
  hasTotpEnrolled: false,
  hasAuthenticatorLevel: false,
};

function makeRequest(method: string): NextRequest {
  return new NextRequest(`http://localhost/api/download/${ENT_ID}`, { method });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── AC1: GET is refused ──────────────────────────────────────────────────────

describe("GET /api/download/[entitlementId]", () => {
  it("returns 405 — a GET can never use up a download", async () => {
    const res = await GET();
    expect(res.status).toBe(405);
  });
});

// ─── AC1: POST needs sign-in ──────────────────────────────────────────────────

describe("POST /api/download/[entitlementId] — auth gate", () => {
  it("returns 401 when not signed in", async () => {
    vi.mocked(requireActiveAccount).mockResolvedValue({ ok: false, code: "not_found" } as never);
    const req = makeRequest("POST");
    const params = Promise.resolve({ entitlementId: ENT_ID });
    const res = await POST(req, { params });
    expect(res.status).toBe(401);
  });

  it("returns 403 when account is suspended", async () => {
    vi.mocked(requireActiveAccount).mockResolvedValue({ ok: false, code: "not_allowed" } as never);
    const req = makeRequest("POST");
    const params = Promise.resolve({ entitlementId: ENT_ID });
    const res = await POST(req, { params });
    expect(res.status).toBe(403);
  });
});

// ─── AC1: rate limit ─────────────────────────────────────────────────────────

describe("POST /api/download/[entitlementId] — rate limit", () => {
  it("returns 429 when rate limit exceeded", async () => {
    vi.mocked(requireActiveAccount).mockResolvedValue({ ok: true, user: ACTIVE_USER } as never);
    vi.mocked(checkRateLimit).mockResolvedValue({ ok: false } as never);
    const req = makeRequest("POST");
    const params = Promise.resolve({ entitlementId: ENT_ID });
    const res = await POST(req, { params });
    expect(res.status).toBe(429);
  });
});

// ─── AC1: invalid entitlementId ──────────────────────────────────────────────

describe("POST /api/download/[entitlementId] — validation", () => {
  it("returns 400 when entitlementId is not a UUID", async () => {
    vi.mocked(requireActiveAccount).mockResolvedValue({ ok: true, user: ACTIVE_USER } as never);
    vi.mocked(checkRateLimit).mockResolvedValue({ ok: true } as never);
    const req = new NextRequest("http://localhost/api/download/not-a-uuid", { method: "POST" });
    const params = Promise.resolve({ entitlementId: "not-a-uuid" });
    const res = await POST(req, { params });
    expect(res.status).toBe(400);
  });
});

// ─── AC5: file key never in response ─────────────────────────────────────────

describe("POST /api/download/[entitlementId] — success", () => {
  it("returns 200 with only the signed url, no file key", async () => {
    vi.mocked(requireActiveAccount).mockResolvedValue({ ok: true, user: ACTIVE_USER } as never);
    vi.mocked(checkRateLimit).mockResolvedValue({ ok: true } as never);
    vi.mocked(claimDownload).mockResolvedValue({
      ok: true,
      data: { signedUrl: "https://r2.example.com/signed?X-Amz=abc" },
    } as never);
    const req = makeRequest("POST");
    const params = Promise.resolve({ entitlementId: ENT_ID });
    const res = await POST(req, { params });
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body).toHaveProperty("url");
    expect(body).not.toHaveProperty("fileKey");
    expect(body).not.toHaveProperty("key");
    expect(body).not.toHaveProperty("file_key");
    // The url must not be a plain R2 key (no bucket-style paths without query string)
    expect(typeof body["url"]).toBe("string");
    expect((body["url"] as string).startsWith("https://")).toBe(true);
  });

  it("returns 402 (download_limit_reached) when limit used up", async () => {
    vi.mocked(requireActiveAccount).mockResolvedValue({ ok: true, user: ACTIVE_USER } as never);
    vi.mocked(checkRateLimit).mockResolvedValue({ ok: true } as never);
    vi.mocked(claimDownload).mockResolvedValue({ ok: false, code: "download_limit_reached" } as never);
    const req = makeRequest("POST");
    const params = Promise.resolve({ entitlementId: ENT_ID });
    const res = await POST(req, { params });
    expect(res.status).toBe(402);
    const body = await res.json() as Record<string, unknown>;
    expect(body["code"]).toBe("download_limit_reached");
  });

  it("returns 404 for another user's entitlement", async () => {
    vi.mocked(requireActiveAccount).mockResolvedValue({ ok: true, user: ACTIVE_USER } as never);
    vi.mocked(checkRateLimit).mockResolvedValue({ ok: true } as never);
    vi.mocked(claimDownload).mockResolvedValue({ ok: false, code: "not_found" } as never);
    const req = makeRequest("POST");
    const params = Promise.resolve({ entitlementId: ENT_ID });
    const res = await POST(req, { params });
    expect(res.status).toBe(404);
  });

  it("returns 503 when file is missing in store", async () => {
    vi.mocked(requireActiveAccount).mockResolvedValue({ ok: true, user: ACTIVE_USER } as never);
    vi.mocked(checkRateLimit).mockResolvedValue({ ok: true } as never);
    vi.mocked(claimDownload).mockResolvedValue({ ok: false, code: "file_unavailable" } as never);
    const req = makeRequest("POST");
    const params = Promise.resolve({ entitlementId: ENT_ID });
    const res = await POST(req, { params });
    expect(res.status).toBe(503);
    const body = await res.json() as Record<string, unknown>;
    expect(body["code"]).toBe("file_unavailable");
  });
});

// ─── EC6: approve for suspended buyer → download still refused ───────────────
// Staff can approve a request even if the buyer's account is suspended (the
// approval is recorded). When the buyer then tries to download, requireActiveAccount
// returns not_allowed → 403. The download route never reaches claimDownload.

describe("POST /api/download/[entitlementId] — EC6: suspended buyer after approval", () => {
  it("returns 403 for a suspended buyer even when download is newly approved", async () => {
    // requireActiveAccount sees the suspended flag and refuses before the
    // download logic runs. The staff approval of the request is unaffected.
    vi.mocked(requireActiveAccount).mockResolvedValue({ ok: false, code: "not_allowed" } as never);
    const req = makeRequest("POST");
    const params = Promise.resolve({ entitlementId: ENT_ID });
    const res = await POST(req, { params });
    expect(res.status).toBe(403);
    // claimDownload must NOT have been called
    expect(vi.mocked(claimDownload)).not.toHaveBeenCalled();
  });
});
