// S-101: getAdminToday unit tests.
// No real DB — mocks Supabase client, requireStaff, writeSessionStart.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({
  serverConfig: { supabaseServiceRoleKey: "srk" },
  publicConfig: { supabaseUrl: "https://test.supabase.co", supabaseAnonKey: "anon" },
}));

// ─── Supabase mock ────────────────────────────────────────────────────────────

const mockRpc = vi.fn();
const mockFrom = vi.fn();

const mockServiceRoleFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(() => ({
    rpc: mockRpc,
    from: mockFrom,
  })),
  createSupabaseServiceRoleClient: vi.fn(() => ({
    rpc: mockRpc,
    from: mockServiceRoleFrom,
  })),
}));

// ─── requireStaff mock ────────────────────────────────────────────────────────

vi.mock("@/lib/auth/server", () => ({
  requireStaff: vi.fn(),
}));

// ─── Audit mock ───────────────────────────────────────────────────────────────

vi.mock("@/lib/audit/index", () => ({
  writeSessionStart: vi.fn(),
}));

// ─── Import SUT after mocks ───────────────────────────────────────────────────

import { getAdminToday, todayColomboRange } from "@/lib/admin/today";
import { requireStaff } from "@/lib/auth/server";
import { writeSessionStart } from "@/lib/audit/index";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

const mockRequireStaff = vi.mocked(requireStaff);
const mockWriteSessionStart = vi.mocked(writeSessionStart);
const mockCreateServiceRoleClient = vi.mocked(createSupabaseServiceRoleClient);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LAST_SIGN_IN = "2026-11-24T08:00:00.000Z";

const ADMIN_USER = {
  id: "user-admin-0001",
  email: "admin@test.com",
  claimedRole: "admin" as const,
  hasAuthenticatorLevel: true,
  hasTotpEnrolled: true,
  lastFullSignIn: LAST_SIGN_IN,
};

/** Returns a minimal chainable Supabase query builder that resolves to `result`. */
function qb(result: { data: unknown; error: null | { message: string } }) {
  const chain: Record<string, unknown> = {};
  const methods = ["select", "eq", "neq", "in", "not", "is", "gte", "lt", "order", "limit", "single", "maybeSingle"];
  for (const m of methods) {
    chain[m] = vi.fn(() => chain);
  }
  chain.then = (resolve: (v: unknown) => void) => Promise.resolve(result).then(resolve);
  return chain;
}

/** Sets up mockRpc for has_permission: returns true for all permissions. */
function allPermitted() {
  mockRpc.mockImplementation((fn: string) => {
    if (fn === "has_permission") return Promise.resolve({ data: true, error: null });
    return Promise.resolve({ data: null, error: null });
  });
}

/**
 * Sets mockRequireStaff so the first call (comments.moderate) succeeds, then
 * rpc returns true for remaining permissions (super_admin path skipped since
 * user is admin — the loop finds the first permitted perm, then checks rest via rpc).
 */
function setupAdminWithAllPerms() {
  // First requireStaff call succeeds (comments.moderate)
  mockRequireStaff.mockResolvedValue({ ok: true, user: ADMIN_USER });
  allPermitted();
}

/** Returns not_allowed for every requireStaff call, simulating no permissions. */
function setupNoPermissions() {
  mockRequireStaff.mockResolvedValue({ ok: false, code: "not_allowed" });
  mockRpc.mockResolvedValue({ data: false, error: null });
}

/**
 * mockFrom: returns [] for user_roles (SA IDs fetch) and
 * count=0 aggregate for all queue tables.
 * mockServiceRoleFrom: returns aggregate data for bank_transfer_queue.
 */
function setupEmptyQueues() {
  mockFrom.mockImplementation((table: string) => {
    if (table === "user_roles") return qb({ data: [], error: null });
    return qb({ data: [{ count: 0, oldest: null }], error: null });
  });
  mockServiceRoleFrom.mockImplementation(() =>
    qb({ data: [{ count: 0, oldest: null }], error: null })
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockWriteSessionStart.mockResolvedValue(undefined);
  // Default: service role returns empty bank_transfer_queue rows
  mockServiceRoleFrom.mockImplementation(() =>
    qb({ data: [{ count: 0, oldest: null }], error: null })
  );
});

// ─── AC6 / S17: auth error propagation ───────────────────────────────────────

describe("AC6 / S17: auth error propagation", () => {
  it("propagates mfa_required from requireStaff on first call", async () => {
    mockRequireStaff.mockResolvedValue({ ok: false, code: "mfa_required" });
    const result = await getAdminToday();
    expect(result).toEqual({ ok: false, code: "mfa_required" });
    expect(mockWriteSessionStart).not.toHaveBeenCalled();
  });

  it("propagates reauth_required from requireStaff on first call", async () => {
    mockRequireStaff.mockResolvedValue({ ok: false, code: "reauth_required" });
    const result = await getAdminToday();
    expect(result).toEqual({ ok: false, code: "reauth_required" });
    expect(mockWriteSessionStart).not.toHaveBeenCalled();
  });

  it("S17: propagates not_allowed for a suspended/blocked account", async () => {
    // requireStaff returns not_allowed for all 4 perms (suspended account path)
    mockRequireStaff.mockResolvedValue({ ok: false, code: "not_allowed" });
    const result = await getAdminToday();
    expect(result).toEqual({ ok: false, code: "not_allowed" });
    expect(mockWriteSessionStart).not.toHaveBeenCalled();
  });
});

// ─── AC2: permission filtering ────────────────────────────────────────────────

describe("AC2: permission filtering", () => {
  it("returns not_allowed when staff has no queue permissions at all", async () => {
    setupNoPermissions();
    const result = await getAdminToday();
    expect(result).toEqual({ ok: false, code: "not_allowed" });
  });

  it("returns only lines the caller may open", async () => {
    // requireStaff succeeds on first call (comments.moderate)
    mockRequireStaff.mockResolvedValue({ ok: true, user: ADMIN_USER });
    // Only comments.moderate permitted via rpc
    mockRpc.mockImplementation((_fn: string, { p_action }: { p_action: string }) =>
      Promise.resolve({ data: p_action === "comments.moderate", error: null })
    );
    mockFrom.mockImplementation((table: string) => {
      if (table === "user_roles") return qb({ data: [], error: null });
      return qb({ data: [{ count: 2, oldest: "2026-01-01T00:00:00Z" }], error: null });
    });
    const result = await getAdminToday();
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    expect(result.comments).toBeDefined();
    expect(result.bankSlips).toBeUndefined();
    expect(result.downloadRequests).toBeUndefined();
    expect(result.ordersNeedingReview).toBeUndefined();
    expect(result.todayOrders).toBeUndefined();
  });
});

// ─── AC7: session_start audit row ────────────────────────────────────────────

describe("AC7: session_start audit", () => {
  it("calls writeSessionStart with userId and lastFullSignIn after auth passes", async () => {
    setupAdminWithAllPerms();
    setupEmptyQueues();
    await getAdminToday();
    // Session key is user.lastFullSignIn (stable across token refreshes — P1d fix)
    expect(mockWriteSessionStart).toHaveBeenCalledWith(ADMIN_USER.id, LAST_SIGN_IN);
  });

  it("falls back to user.id when lastFullSignIn is undefined", async () => {
    const userNoSignIn = { ...ADMIN_USER, lastFullSignIn: undefined };
    mockRequireStaff.mockResolvedValue({ ok: true, user: userNoSignIn });
    allPermitted();
    setupEmptyQueues();
    await getAdminToday();
    expect(mockWriteSessionStart).toHaveBeenCalledWith(ADMIN_USER.id, ADMIN_USER.id);
  });
});

// ─── AC1: counts per queue ────────────────────────────────────────────────────

describe("AC1: counts returned per queue", () => {
  it("returns all five lines when caller has all permissions", async () => {
    setupAdminWithAllPerms();
    const OLDEST = "2026-11-01T08:00:00.000Z";
    let callCount = 0;
    const countingQb = () => {
      callCount++;
      return qb({ data: [{ count: callCount, oldest: OLDEST }], error: null });
    };
    mockFrom.mockImplementation((table: string) => {
      if (table === "user_roles") return qb({ data: [], error: null });
      return countingQb();
    });
    mockServiceRoleFrom.mockImplementation(() => countingQb());
    const result = await getAdminToday();
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    expect(result.comments).toBeDefined();
    expect(result.bankSlips).toBeDefined();
    expect(result.downloadRequests).toBeDefined();
    expect(result.ordersNeedingReview).toBeDefined();
    expect(result.todayOrders).toBeDefined();
  });
});

// ─── P0 fix: bank slips uses service-role client ─────────────────────────────

describe("countBankSlips: service-role client", () => {
  it("queries bank_transfer_queue via createSupabaseServiceRoleClient, not session client", async () => {
    setupAdminWithAllPerms();
    setupEmptyQueues();
    await getAdminToday();
    expect(mockCreateServiceRoleClient).toHaveBeenCalled();
    // SA IDs also use service role; both calls go to the same mock.
    // Verify bank_transfer_queue was queried via the service-role from.
    const calls = mockServiceRoleFrom.mock.calls.map((c) => c[0]);
    expect(calls).toContain("bank_transfer_queue");
  });
});

// ─── EC1: empty queues ────────────────────────────────────────────────────────

describe("EC1: empty queues", () => {
  it("returns all lines with count 0 when queues are empty", async () => {
    setupAdminWithAllPerms();
    setupEmptyQueues();
    const result = await getAdminToday();
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    expect(result.comments).toEqual({ count: 0, oldestAt: null });
    expect(result.bankSlips).toEqual({ count: 0, oldestAt: null, needsSecondApproval: 0 });
    expect(result.downloadRequests).toEqual({ count: 0, oldestAt: null });
    expect(result.ordersNeedingReview).toEqual({ count: 0, oldestAt: null });
    expect(result.todayOrders).toEqual({ count: 0, grossCents: 0 });
  });
});

// ─── EC4: video_comments counted when article_comments is empty ───────────────

describe("EC4: video_comments positive path", () => {
  it("counts video comments when article_comments is empty", async () => {
    setupAdminWithAllPerms();
    mockFrom.mockImplementation((table: string) => {
      if (table === "user_roles") return qb({ data: [], error: null });
      if (table === "article_comments")
        return qb({ data: [{ count: 0, oldest: null }], error: null });
      if (table === "video_comments")
        return qb({ data: [{ count: 3, oldest: "2026-11-20T07:00:00.000Z" }], error: null });
      return qb({ data: [{ count: 0, oldest: null }], error: null });
    });
    const result = await getAdminToday();
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    expect(result.comments).toEqual({
      count: 3,
      oldestAt: "2026-11-20T07:00:00.000Z",
    });
  });
});

// ─── AC2: last-position permission succeeds ───────────────────────────────────

describe("AC2: last-position permission loop", () => {
  it("returns orders lines when only orders.read is granted (first 3 perms denied)", async () => {
    // requireStaff returns not_allowed for the first 3 perms, ok for the 4th
    let callCount = 0;
    mockRequireStaff.mockImplementation(() => {
      callCount++;
      if (callCount < 4) return Promise.resolve({ ok: false, code: "not_allowed" });
      return Promise.resolve({ ok: true, user: ADMIN_USER });
    });
    // has_permission for the already-denied perms: return false; orders.read not re-checked
    mockRpc.mockResolvedValue({ data: false, error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === "user_roles") return qb({ data: [], error: null });
      return qb({ data: [{ count: 1, oldest: "2026-11-24T01:00:00.000Z" }], error: null });
    });
    const result = await getAdminToday();
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    expect(result.comments).toBeUndefined();
    expect(result.bankSlips).toBeUndefined();
    expect(result.downloadRequests).toBeUndefined();
    expect(result.ordersNeedingReview).toBeDefined();
    expect(result.todayOrders).toBeDefined();
  });
});

// ─── AC4 / EC3: Sri Lanka day boundary ───────────────────────────────────────

describe("AC4/EC3: Sri Lanka day boundary", () => {
  it("todayColomboRange returns a range enclosing a Colombo midnight", () => {
    // 2026-11-24 00:00 Colombo = 2026-11-23T18:30:00Z
    vi.setSystemTime(new Date("2026-11-24T10:00:00Z")); // 15:30 Colombo — same day
    const { start, end } = todayColomboRange();
    expect(new Date(start).toISOString()).toBe("2026-11-23T18:30:00.000Z");
    expect(new Date(end).toISOString()).toBe("2026-11-24T18:30:00.000Z");
    vi.useRealTimers();
  });

  it("an order at 23:59 Colombo lands on the right day", () => {
    vi.setSystemTime(new Date("2026-11-24T18:00:00Z")); // 23:30 Colombo
    const { start, end } = todayColomboRange();
    const orderAt = new Date("2026-11-24T18:29:00Z"); // 23:59 Colombo
    expect(orderAt >= new Date(start) && orderAt < new Date(end)).toBe(true);
    vi.useRealTimers();
  });

  it("an order at 00:01 Colombo next day falls outside today's range", () => {
    vi.setSystemTime(new Date("2026-11-24T18:00:00Z")); // today is 24 Nov Colombo
    const { start, end } = todayColomboRange();
    const orderAt = new Date("2026-11-24T18:31:00Z"); // 00:01 Colombo 25 Nov
    expect(orderAt >= new Date(start) && orderAt < new Date(end)).toBe(false);
    vi.useRealTimers();
  });
});
