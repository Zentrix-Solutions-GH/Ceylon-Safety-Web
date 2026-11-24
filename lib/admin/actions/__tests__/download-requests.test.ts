// S-085: approveDownloadRequest, rejectDownloadRequest, getDownloadRequestQueue — AC10–AC13

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({
  serverConfig: { supabaseServiceRoleKey: "srk", emailFrom: "no-reply@ceylonsafety.lk" },
  publicConfig: { appUrl: "https://ceylonsafety.lk" },
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
  createSupabaseServiceRoleClient: vi.fn(),
}));
vi.mock("@/lib/auth/server", () => ({ requireStaff: vi.fn() }));
vi.mock("@/lib/ratelimit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/resend/client", () => ({ sendQueuedEmail: vi.fn() }));
vi.mock("@/lib/resend/templates/download-request-approved", () => ({
  renderDownloadApprovedEmail: vi.fn(() => ({ subject: "Approved", html: "<p>a</p>", text: "a" })),
}));
vi.mock("@/lib/resend/templates/download-request-rejected", () => ({
  renderDownloadRejectedEmail: vi.fn(() => ({ subject: "Rejected", html: "<p>r</p>", text: "r" })),
}));

import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/server";
import { checkRateLimit } from "@/lib/ratelimit";
import { sendQueuedEmail } from "@/lib/resend/client";
import { renderDownloadApprovedEmail } from "@/lib/resend/templates/download-request-approved";
import {
  approveDownloadRequest,
  rejectDownloadRequest,
  getDownloadRequestQueue,
  getDownloadRequestBadgeCount,
} from "@/lib/admin/actions/download-requests";

const REQUEST_ID  = "00000000-0000-4000-8000-000000000011";
const ENT_ID      = "00000000-0000-4000-8000-000000000001";
const BUYER_ID    = "user-buyer-1";
const STAFF_ID    = "staff-01";

const STAFF = {
  id: STAFF_ID,
  email: "staff@example.com",
  phone: null,
  claimedRole: "admin" as const,
  hasTotpEnrolled: true,
  hasAuthenticatorLevel: true,
};

const OPEN_REQUEST = {
  id: REQUEST_ID,
  entitlement_id: ENT_ID,
  user_id: BUYER_ID,
  status: "open",
  note: "file failed",
  requested_at: "2026-11-01T00:00:00Z",
  decided_at: null,
  decided_by: null,
  decision_note: null,
};

// Includes embedded profiles join — used to exercise the email-send path.
const OPEN_REQUEST_WITH_PROFILE = {
  ...OPEN_REQUEST,
  profiles: { email: "buyer@example.com", phone: null },
};

function makeServiceDb(requestRow: Record<string, unknown> | null, rpcError: unknown = null) {
  return {
    from: vi.fn((table: string) => {
      if (table === "download_requests") {
        // Chainable update mock: .update({}).eq(...).eq(...) resolves to { error: null }
        const updateChain: Record<string, unknown> = {};
        updateChain["eq"] = vi.fn(() => updateChain);
        updateChain["then"] = (resolve: (v: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve);
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: requestRow,
            error: requestRow ? null : { code: "PGRST116" },
          }),
          update: vi.fn(() => updateChain),
        };
      }
      if (table === "entitlements") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: ENT_ID, user_id: BUYER_ID, order_item_id: "oi-uuid-approve-1" },
            error: null,
          }),
        };
      }
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: BUYER_ID, email: "buyer@example.com", phone: null },
            error: null,
          }),
        };
      }
      if (table === "email_logs") {
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      }
      if (table === "admin_audit_log") {
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      }
      return { insert: vi.fn().mockResolvedValue({ error: null }) };
    }),
    rpc: vi.fn().mockResolvedValue({ data: null, error: rpcError }),
  };
}

function mockStaffOk() {
  vi.mocked(requireStaff).mockResolvedValue({ ok: true, user: STAFF } as never);
  vi.mocked(checkRateLimit).mockResolvedValue({ ok: true } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── approveDownloadRequest — permission gate ─────────────────────────────────

describe("approveDownloadRequest — permission gate", () => {
  it("returns not_allowed when staff auth fails", async () => {
    vi.mocked(requireStaff).mockResolvedValue({ ok: false, code: "not_allowed" } as never);
    const result = await approveDownloadRequest(REQUEST_ID);
    expect(result).toMatchObject({ ok: false, code: "not_allowed" });
  });

  it("returns rate_limited when rate limit exceeded", async () => {
    vi.mocked(requireStaff).mockResolvedValue({ ok: true, user: STAFF } as never);
    vi.mocked(checkRateLimit).mockResolvedValue({ ok: false } as never);
    const result = await approveDownloadRequest(REQUEST_ID);
    expect(result).toMatchObject({ ok: false, code: "rate_limited" });
  });

  it("returns validation_failed for non-UUID requestId", async () => {
    mockStaffOk();
    const result = await approveDownloadRequest("not-a-uuid");
    expect(result).toMatchObject({ ok: false, code: "validation_failed" });
  });
});

// ─── approveDownloadRequest — not found ───────────────────────────────────────

describe("approveDownloadRequest — not found", () => {
  it("returns not_found when request does not exist", async () => {
    mockStaffOk();
    vi.mocked(createSupabaseServerClient).mockResolvedValue(makeServiceDb(null) as never);
    vi.mocked(createSupabaseServiceRoleClient).mockResolvedValue(makeServiceDb(null) as never);
    const result = await approveDownloadRequest(REQUEST_ID);
    expect(result).toMatchObject({ ok: false, code: "not_found" });
  });
});

// ─── approveDownloadRequest — AC12: already decided ──────────────────────────

describe("approveDownloadRequest — already decided (AC12)", () => {
  it("returns validation_failed/already_done when request is already approved", async () => {
    mockStaffOk();
    const decided = { ...OPEN_REQUEST, status: "approved", decided_at: "2026-11-01T01:00:00Z", decided_by: STAFF_ID };
    vi.mocked(createSupabaseServerClient).mockResolvedValue(makeServiceDb(decided) as never);
    vi.mocked(createSupabaseServiceRoleClient).mockResolvedValue(makeServiceDb(decided) as never);
    const result = await approveDownloadRequest(REQUEST_ID);
    expect(result).toMatchObject({ ok: false, code: "validation_failed", reason: "already_done" });
  });

  it("returns validation_failed/already_done when request is already rejected", async () => {
    mockStaffOk();
    const decided = { ...OPEN_REQUEST, status: "rejected", decided_at: "2026-11-01T01:00:00Z", decided_by: STAFF_ID };
    vi.mocked(createSupabaseServerClient).mockResolvedValue(makeServiceDb(decided) as never);
    vi.mocked(createSupabaseServiceRoleClient).mockResolvedValue(makeServiceDb(decided) as never);
    const result = await approveDownloadRequest(REQUEST_ID);
    expect(result).toMatchObject({ ok: false, code: "validation_failed", reason: "already_done" });
  });
});

// ─── approveDownloadRequest — AC12: DB raises already_done on concurrent double-approval ──

describe("approveDownloadRequest — concurrent already_done from DB (AC12)", () => {
  it("returns validation_failed/already_done when DB function raises already_done", async () => {
    // Simulates: server-layer status check passes (request shows open), but
    // the DB function raises restrict_violation/already_done because a concurrent
    // approval already committed (the FOR UPDATE lock was released by the first caller).
    mockStaffOk();
    const rpcErr = { message: "ceylonsafety: already_done", code: "restrict_violation" };
    const db = makeServiceDb(OPEN_REQUEST, rpcErr);
    vi.mocked(createSupabaseServerClient).mockResolvedValue(db as never);
    vi.mocked(createSupabaseServiceRoleClient).mockResolvedValue(db as never);
    const result = await approveDownloadRequest(REQUEST_ID);
    expect(result).toMatchObject({ ok: false, code: "validation_failed", reason: "already_done" });
  });
});

// ─── approveDownloadRequest — AC10: self-approval refused ────────────────────

describe("approveDownloadRequest — self-approval (AC10)", () => {
  it("returns not_allowed when staff is the buyer (same user_id)", async () => {
    // Staff id == buyer id
    const selfStaff = { ...STAFF, id: BUYER_ID };
    vi.mocked(requireStaff).mockResolvedValue({ ok: true, user: selfStaff } as never);
    vi.mocked(checkRateLimit).mockResolvedValue({ ok: true } as never);
    vi.mocked(createSupabaseServerClient).mockResolvedValue(makeServiceDb(OPEN_REQUEST) as never);
    vi.mocked(createSupabaseServiceRoleClient).mockResolvedValue(makeServiceDb(OPEN_REQUEST) as never);
    const result = await approveDownloadRequest(REQUEST_ID);
    expect(result).toMatchObject({ ok: false, code: "not_allowed" });
  });
});

// ─── approveDownloadRequest — AC10: success ───────────────────────────────────

describe("approveDownloadRequest — entitlement fetch error skips email", () => {
  it("returns ok:true but does not send email when entitlements DB returns error", async () => {
    mockStaffOk();
    const dbWithEntErr = {
      ...makeServiceDb(OPEN_REQUEST_WITH_PROFILE),
      from: vi.fn((table: string) => {
        if (table === "entitlements") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: "08006", message: "connection failure" },
            }),
          };
        }
        return makeServiceDb(OPEN_REQUEST_WITH_PROFILE).from(table);
      }),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    vi.mocked(createSupabaseServerClient).mockResolvedValue(dbWithEntErr as never);
    vi.mocked(createSupabaseServiceRoleClient).mockResolvedValue(dbWithEntErr as never);
    const result = await approveDownloadRequest(REQUEST_ID);
    expect(result.ok).toBe(true);
    expect(vi.mocked(sendQueuedEmail)).not.toHaveBeenCalled();
  });
});

describe("approveDownloadRequest — success (AC10/AC3)", () => {
  it("calls approve_download_request RPC and sends approval email with correct download URL (AC3)", async () => {
    mockStaffOk();
    const db = makeServiceDb(OPEN_REQUEST_WITH_PROFILE);
    vi.mocked(createSupabaseServerClient).mockResolvedValue(db as never);
    vi.mocked(createSupabaseServiceRoleClient).mockResolvedValue(db as never);
    const result = await approveDownloadRequest(REQUEST_ID);
    expect(result.ok).toBe(true);
    expect(db.rpc).toHaveBeenCalledWith("approve_download_request", {
      p_request_id: REQUEST_ID,
      p_admin_id: STAFF_ID,
    });
    expect(vi.mocked(sendQueuedEmail)).toHaveBeenCalledWith(
      expect.objectContaining({ template: "download_request_approved" })
    );
    // AC3: invoke the captured renderEmail lambda to verify it passes the correct download URL
    const callArg = vi.mocked(sendQueuedEmail).mock.calls[0]?.[0];
    callArg?.renderEmail("buyer@example.com");
    expect(vi.mocked(renderDownloadApprovedEmail)).toHaveBeenCalledWith(
      expect.objectContaining({
        downloadUrl: "https://ceylonsafety.lk/download/oi-uuid-approve-1",
      })
    );
  });
});

// ─── rejectDownloadRequest — AC11 ─────────────────────────────────────────────

describe("rejectDownloadRequest — requires note (AC11)", () => {
  it("returns validation_failed when note is empty", async () => {
    mockStaffOk();
    vi.mocked(createSupabaseServerClient).mockResolvedValue(makeServiceDb(OPEN_REQUEST) as never);
    vi.mocked(createSupabaseServiceRoleClient).mockResolvedValue(makeServiceDb(OPEN_REQUEST) as never);
    const result = await rejectDownloadRequest(REQUEST_ID, "");
    expect(result).toMatchObject({ ok: false, code: "validation_failed", field: "note" });
  });

  it("returns validation_failed/already_done for a decided request (AC12)", async () => {
    mockStaffOk();
    const decided = { ...OPEN_REQUEST, status: "rejected" };
    vi.mocked(createSupabaseServerClient).mockResolvedValue(makeServiceDb(decided) as never);
    vi.mocked(createSupabaseServiceRoleClient).mockResolvedValue(makeServiceDb(decided) as never);
    const result = await rejectDownloadRequest(REQUEST_ID, "buyer already received refund");
    expect(result).toMatchObject({ ok: false, code: "validation_failed", reason: "already_done" });
  });
});

describe("rejectDownloadRequest — concurrent already_done from DB (AC12)", () => {
  it("returns validation_failed/already_done when DB function raises already_done", async () => {
    mockStaffOk();
    const rpcErr = { message: "ceylonsafety: already_done", code: "restrict_violation" };
    const db = makeServiceDb(OPEN_REQUEST, rpcErr);
    vi.mocked(createSupabaseServerClient).mockResolvedValue(db as never);
    vi.mocked(createSupabaseServiceRoleClient).mockResolvedValue(db as never);
    const result = await rejectDownloadRequest(REQUEST_ID, "buyer already refunded");
    expect(result).toMatchObject({ ok: false, code: "validation_failed", reason: "already_done" });
  });
});

describe("rejectDownloadRequest — success (AC11/AC4)", () => {
  it("marks request rejected and sends rejection email (AC4)", async () => {
    mockStaffOk();
    const db = makeServiceDb(OPEN_REQUEST_WITH_PROFILE);
    vi.mocked(createSupabaseServerClient).mockResolvedValue(db as never);
    vi.mocked(createSupabaseServiceRoleClient).mockResolvedValue(db as never);
    const result = await rejectDownloadRequest(REQUEST_ID, "buyer already received refund");
    expect(result.ok).toBe(true);
    expect(vi.mocked(sendQueuedEmail)).toHaveBeenCalledWith(
      expect.objectContaining({ template: "download_request_rejected" })
    );
  });
});

// ─── getDownloadRequestQueue — AC13 ──────────────────────────────────────────

describe("getDownloadRequestQueue — permission gate (AC13)", () => {
  it("returns not_allowed when staff auth fails", async () => {
    vi.mocked(requireStaff).mockResolvedValue({ ok: false, code: "not_allowed" } as never);
    const result = await getDownloadRequestQueue();
    expect(result).toMatchObject({ ok: false, code: "not_allowed" });
  });
});

describe("getDownloadRequestQueue — success (AC13)", () => {
  it("returns open requests list", async () => {
    mockStaffOk();
    const db = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: [
              {
                request_id: REQUEST_ID,
                entitlement_id: ENT_ID,
                note: "failed",
                requested_at: "2026-11-01T00:00:00Z",
                buyer_name: "Test Buyer",
                buyer_email: "buyer@example.com",
                document_title: "Safety Plan",
                language: "en",
                last_download_at: null,
              },
            ],
            error: null,
          }),
        }),
        count: vi.fn().mockResolvedValue({ count: 1, error: null }),
      })),
    };
    vi.mocked(createSupabaseServiceRoleClient).mockResolvedValue(db as never);
    const result = await getDownloadRequestQueue();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data?.items.length).toBe(1);
    expect(result.data?.items[0]?.requestId).toBe(REQUEST_ID);
  });
});

// ─── getDownloadRequestBadgeCount — AC13 ──────────────────────────────────────

describe("getDownloadRequestBadgeCount (AC13)", () => {
  it("returns count of open requests for staff with permission", async () => {
    vi.mocked(requireStaff).mockResolvedValue({ ok: true, user: STAFF } as never);
    const db = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ count: 3, error: null }),
      })),
    };
    vi.mocked(createSupabaseServiceRoleClient).mockResolvedValue(db as never);
    const result = await getDownloadRequestBadgeCount();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(typeof result.data?.count).toBe("number");
  });

  it("returns not_allowed when staff auth fails", async () => {
    vi.mocked(requireStaff).mockResolvedValue({ ok: false, code: "not_allowed" } as never);
    const result = await getDownloadRequestBadgeCount();
    expect(result).toMatchObject({ ok: false, code: "not_allowed" });
  });
});
