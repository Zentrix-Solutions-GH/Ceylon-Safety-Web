import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type MockOrderRow = {
  order_number: string;
  created_at: string;
  status: string;
  payment_method: string | null;
  total_cents: number;
  profiles: { first_name: string; last_name: string; email: string } | null;
  order_items: Array<{
    title_snapshot: string;
    language: string;
    line_total_cents: number;
  }>;
};

function makeRow(overrides: Partial<MockOrderRow> = {}): MockOrderRow {
  return {
    order_number: "CS-2026-0001",
    created_at: "2026-11-01T05:30:00+05:30",
    status: "paid",
    payment_method: "payhere_card",
    total_cents: 150000,
    profiles: { first_name: "Nimal", last_name: "Silva", email: "nimal@example.com" },
    order_items: [
      { title_snapshot: "Fire Safety Checklist", language: "en", line_total_cents: 150000 },
    ],
    ...overrides,
  };
}

// Mock Supabase service role client
function makeSupabaseMock(rows: MockOrderRow[] = [makeRow()]) {
  const rangeResult = { data: rows, error: null };
  const rangeFn = vi.fn().mockResolvedValue(rangeResult);
  const orderFn = vi.fn().mockReturnValue({ range: rangeFn });
  const eqFn = vi.fn().mockReturnThis();
  const gteFn = vi.fn().mockReturnThis();
  const lteFn = vi.fn().mockReturnThis();
  const selectFn = vi.fn().mockReturnValue({
    eq: eqFn,
    gte: gteFn,
    lte: lteFn,
    order: orderFn,
  });
  const fromFn = vi.fn().mockReturnValue({ select: selectFn });
  return { from: fromFn, select: selectFn, range: rangeFn, order: orderFn };
}

// ---------------------------------------------------------------------------
// Module setup — reset mocks per test to avoid bleed
// ---------------------------------------------------------------------------

const mockRequireStaff = vi.fn();
const mockWriteAuditRow = vi.fn().mockResolvedValue(undefined);
const mockSendOwnerAlert = vi.fn().mockResolvedValue(undefined);
const mockCheckExportRateLimit = vi.fn();
const mockSupabase = vi.fn();

vi.mock("@/lib/auth/server", () => ({
  requireStaff: mockRequireStaff,
}));
vi.mock("@/lib/audit/index", () => ({
  writeAuditRow: mockWriteAuditRow,
}));
vi.mock("@/lib/alerts/owner-alert", () => ({
  sendOwnerAlert: mockSendOwnerAlert,
}));
vi.mock("@/lib/admin/export/csv-rate-limit", () => ({
  checkExportRateLimit: mockCheckExportRateLimit,
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: mockSupabase,
}));

const SUPER_ADMIN_USER = { id: "admin-uuid-1", claimedRole: "super_admin" };
const ADMIN_USER = { id: "admin-uuid-2", claimedRole: "admin" };

function okAuth(user = SUPER_ADMIN_USER) {
  mockRequireStaff.mockResolvedValue({ ok: true, user });
}

function mockDb(rows: MockOrderRow[]) {
  const db = makeSupabaseMock(rows);
  mockSupabase.mockReturnValue(db);
  return db;
}

async function GET(url: string) {
  const { GET: handler } = await import("@/app/api/admin/orders-export/route");
  return handler(new NextRequest(`http://localhost${url}`));
}

beforeEach(() => {
  vi.resetModules();
  mockRequireStaff.mockReset();
  mockWriteAuditRow.mockReset().mockResolvedValue(undefined);
  mockSendOwnerAlert.mockReset().mockResolvedValue(undefined);
  mockCheckExportRateLimit.mockReset().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
  mockSupabase.mockReset();
});

afterEach(() => vi.restoreAllMocks());

// ---------------------------------------------------------------------------
// AC1 — valid request returns streaming CSV with correct columns
// ---------------------------------------------------------------------------

describe("AC1: valid range returns CSV with correct columns", () => {
  it("returns 200 text/csv with header row", async () => {
    okAuth();
    mockDb([makeRow()]);

    const res = await GET("/api/admin/orders-export?from=2026-11-01&to=2026-11-30");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
  });

  it("CSV header row contains all required columns", async () => {
    okAuth();
    mockDb([makeRow()]);

    const res = await GET("/api/admin/orders-export?from=2026-11-01&to=2026-11-30");
    const text = await res.text();
    const headerRow = text.split("\n")[0];
    expect(headerRow).toContain("order_ref");
    expect(headerRow).toContain("date");
    expect(headerRow).toContain("buyer_name");
    expect(headerRow).toContain("document_title");
    expect(headerRow).toContain("language");
    expect(headerRow).toContain("unit_price_lkr");
    expect(headerRow).toContain("total_lkr");
    expect(headerRow).toContain("payment_method");
    expect(headerRow).toContain("status");
  });

  it("date is in Asia/Colombo timezone (UTC+5:30)", async () => {
    okAuth();
    // 2026-11-01T00:00:00Z = 2026-11-01T05:30:00+05:30
    mockDb([makeRow({ created_at: "2026-11-01T00:00:00.000Z" })]);

    const res = await GET("/api/admin/orders-export?from=2026-11-01&to=2026-11-30");
    const text = await res.text();
    expect(text).toContain("2026-11-01");
  });

  it("sets Cache-Control: no-store header", async () => {
    okAuth();
    mockDb([makeRow()]);

    const res = await GET("/api/admin/orders-export?from=2026-11-01&to=2026-11-30");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("sets Content-Disposition attachment header", async () => {
    okAuth();
    mockDb([makeRow()]);

    const res = await GET("/api/admin/orders-export?from=2026-11-01&to=2026-11-30");
    expect(res.headers.get("content-disposition")).toMatch(/attachment.*filename/);
  });

  it("requires orders.export permission", async () => {
    mockRequireStaff.mockResolvedValue({ ok: false, code: "not_allowed" });

    const res = await GET("/api/admin/orders-export?from=2026-11-01&to=2026-11-30");
    expect(res.status).toBe(403);
    expect(mockRequireStaff).toHaveBeenCalledWith("orders.export");
  });
});

// ---------------------------------------------------------------------------
// AC2 — email column behaviour
// ---------------------------------------------------------------------------

describe("AC2: buyer email column", () => {
  it("email column is absent by default", async () => {
    okAuth();
    mockDb([makeRow()]);

    const res = await GET("/api/admin/orders-export?from=2026-11-01&to=2026-11-30");
    const text = await res.text();
    const headerRow = text.split("\n")[0];
    expect(headerRow).not.toContain("email");
    expect(text).not.toContain("nimal@example.com");
  });

  it("super admin with include_email=true gets email column", async () => {
    okAuth(SUPER_ADMIN_USER);
    mockDb([makeRow()]);

    const res = await GET("/api/admin/orders-export?from=2026-11-01&to=2026-11-30&include_email=true");
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text.split("\n")[0]).toContain("email");
    expect(text).toContain("nimal@example.com");
  });

  it("non-super-admin with include_email=true gets 403", async () => {
    okAuth(ADMIN_USER);
    mockDb([makeRow()]);

    const res = await GET("/api/admin/orders-export?from=2026-11-01&to=2026-11-30&include_email=true");
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// AC3 — rate limit 3/day
// ---------------------------------------------------------------------------

describe("AC3: rate limit 3 exports per day", () => {
  it("returns 429 when rate limited", async () => {
    okAuth();
    mockCheckExportRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 3600 });

    const res = await GET("/api/admin/orders-export?from=2026-11-01&to=2026-11-30");
    expect(res.status).toBe(429);
  });

  it("includes Retry-After header when rate limited", async () => {
    okAuth();
    mockCheckExportRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 3600 });

    const res = await GET("/api/admin/orders-export?from=2026-11-01&to=2026-11-30");
    expect(res.headers.get("retry-after")).toBe("3600");
  });

  it("passes admin user id to rate limit check", async () => {
    okAuth(ADMIN_USER);
    mockDb([makeRow()]);

    await GET("/api/admin/orders-export?from=2026-11-01&to=2026-11-30");
    expect(mockCheckExportRateLimit).toHaveBeenCalledWith(ADMIN_USER.id);
  });
});

// ---------------------------------------------------------------------------
// AC4 — audit log
// ---------------------------------------------------------------------------

describe("AC4: audit log row written", () => {
  it("writes order.export audit row on success", async () => {
    okAuth();
    mockDb([makeRow()]);

    const res = await GET("/api/admin/orders-export?from=2026-11-01&to=2026-11-30");
    await res.text(); // drain stream so async callbacks fire
    expect(mockWriteAuditRow).toHaveBeenCalledWith(
      expect.objectContaining({ action: "order.export" }),
    );
  });

  it("audit row includes actorId, from, to, row_count, include_email", async () => {
    okAuth(SUPER_ADMIN_USER);
    mockDb([makeRow(), makeRow({ order_number: "CS-2026-0002" })]);

    await GET("/api/admin/orders-export?from=2026-11-01&to=2026-11-30");
    const call = mockWriteAuditRow.mock.calls[0][0];
    expect(call.actorId).toBe(SUPER_ADMIN_USER.id);
    expect(call.after).toMatchObject({
      from: "2026-11-01",
      to: "2026-11-30",
      include_email: false,
    });
    expect(typeof call.after?.row_count).toBe("number");
  });

  it("audit row include_email is true when super admin passes include_email=true", async () => {
    okAuth(SUPER_ADMIN_USER);
    mockDb([makeRow()]);

    const res = await GET("/api/admin/orders-export?from=2026-11-01&to=2026-11-30&include_email=true");
    await res.text();
    const call = mockWriteAuditRow.mock.calls[0][0];
    expect(call.after?.include_email).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC5 — owner alert
// ---------------------------------------------------------------------------

describe("AC5: owner alert triggered", () => {
  it("triggers owner alert with order.csv_export event", async () => {
    okAuth();
    mockDb([makeRow()]);

    const res = await GET("/api/admin/orders-export?from=2026-11-01&to=2026-11-30");
    await res.text(); // drain stream so async callbacks fire
    expect(mockSendOwnerAlert).toHaveBeenCalledWith(
      "order.csv_export",
      expect.any(Object),
    );
  });

  it("owner alert failure does not fail the response", async () => {
    okAuth();
    mockDb([makeRow()]);
    mockSendOwnerAlert.mockRejectedValue(new Error("email down"));

    const res = await GET("/api/admin/orders-export?from=2026-11-01&to=2026-11-30");
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// AC6 — input validation
// ---------------------------------------------------------------------------

describe("AC6: date range validation", () => {
  it("missing from returns 400", async () => {
    mockRequireStaff.mockResolvedValue({ ok: true, user: SUPER_ADMIN_USER });
    const res = await GET("/api/admin/orders-export?to=2026-11-30");
    expect(res.status).toBe(400);
  });

  it("missing to returns 400", async () => {
    mockRequireStaff.mockResolvedValue({ ok: true, user: SUPER_ADMIN_USER });
    const res = await GET("/api/admin/orders-export?from=2026-11-01");
    expect(res.status).toBe(400);
  });

  it("invalid date format returns 400", async () => {
    mockRequireStaff.mockResolvedValue({ ok: true, user: SUPER_ADMIN_USER });
    const res = await GET("/api/admin/orders-export?from=01-11-2026&to=2026-11-30");
    expect(res.status).toBe(400);
  });

  it("from > to returns 400", async () => {
    mockRequireStaff.mockResolvedValue({ ok: true, user: SUPER_ADMIN_USER });
    const res = await GET("/api/admin/orders-export?from=2026-11-30&to=2026-11-01");
    expect(res.status).toBe(400);
  });

  it("range > 366 days returns 400", async () => {
    mockRequireStaff.mockResolvedValue({ ok: true, user: SUPER_ADMIN_USER });
    const res = await GET("/api/admin/orders-export?from=2026-01-01&to=2027-02-10");
    expect(res.status).toBe(400);
  });

  it("400 response body contains validation_failed", async () => {
    mockRequireStaff.mockResolvedValue({ ok: true, user: SUPER_ADMIN_USER });
    const res = await GET("/api/admin/orders-export?from=bad&to=2026-11-30");
    const body = await res.json();
    expect(body.error).toBe("validation_failed");
  });
});

// ---------------------------------------------------------------------------
// Unauthenticated — 401
// ---------------------------------------------------------------------------

describe("unauthenticated returns 401", () => {
  it("returns 401 when session expired (reauth_required)", async () => {
    mockRequireStaff.mockResolvedValue({ ok: false, code: "reauth_required" });
    const res = await GET("/api/admin/orders-export?from=2026-11-01&to=2026-11-30");
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// EC1 — zero paid orders → header row only
// ---------------------------------------------------------------------------

describe("EC1: zero orders returns header row only", () => {
  it("empty result set returns 200 with header row only", async () => {
    okAuth();
    mockDb([]);

    const res = await GET("/api/admin/orders-export?from=2026-11-01&to=2026-11-30");
    expect(res.status).toBe(200);
    const text = await res.text();
    const lines = text.trim().split("\n");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("order_ref");
  });
});

// ---------------------------------------------------------------------------
// EC2 — 4th export in a day → 429
// ---------------------------------------------------------------------------

describe("EC2: 4th export returns 429", () => {
  it("4th call returns 429 with Retry-After", async () => {
    okAuth();
    mockCheckExportRateLimit.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 7200 });

    const res = await GET("/api/admin/orders-export?from=2026-11-01&to=2026-11-30");
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("7200");
  });
});

// ---------------------------------------------------------------------------
// CSV injection guard
// ---------------------------------------------------------------------------

describe("CSV injection prevention", () => {
  it("cells starting with = are quoted", async () => {
    okAuth();
    mockDb([makeRow({
      order_items: [{ title_snapshot: "=cmd|' /C calc'!A0", language: "en", line_total_cents: 100 }],
      profiles: { first_name: "=HYPERLINK", last_name: "Test", email: "x@x.com" },
    })]);

    const res = await GET("/api/admin/orders-export?from=2026-11-01&to=2026-11-30");
    const text = await res.text();
    // Dangerous value must NOT appear unquoted at start of a cell
    expect(text).not.toMatch(/^=cmd/m);
    expect(text).not.toMatch(/,=cmd/);
  });
});
