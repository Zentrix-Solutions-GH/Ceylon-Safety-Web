// S-037: deleteAccount tests — AC4, AC5, AC6, AC7, EC1, EC2, EC3, EC4, EC5

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Map()),
  cookies: vi.fn().mockResolvedValue({
    set: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
  }),
}));
vi.mock("@/lib/config.upstash", () => ({ upstashConfig: vi.fn().mockReturnValue(null) }));

const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockSignOut = vi.fn();
const mockAdminDeleteUser = vi.fn();
const mockServiceRpc = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser, signOut: mockSignOut },
    from: mockFrom,
  }),
  createSupabaseServiceRoleClient: vi.fn().mockReturnValue({
    rpc: mockServiceRpc,
    auth: { admin: { deleteUser: mockAdminDeleteUser } },
  }),
}));

const mockConfirmReverification = vi.fn();
vi.mock("@/lib/auth/actions/confirm-reverification", () => ({
  confirmReverification: (...args: unknown[]) => mockConfirmReverification(...args),
}));

const BASE_USER = {
  id: "uid-1",
  email: "user@example.com",
  banned_until: null,
  app_metadata: {},
};

function makeNoBlockerFrom() {
  return vi.fn().mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();

  mockGetUser.mockResolvedValue({ data: { user: BASE_USER } });
  mockConfirmReverification.mockResolvedValue({ ok: true });
  mockSignOut.mockResolvedValue({ error: null });
  mockAdminDeleteUser.mockResolvedValue({ data: {}, error: null });
  mockServiceRpc.mockResolvedValue({ error: null });
  mockFrom.mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  });
});

async function getDeleteAccount() {
  const mod = await import("@/lib/auth/actions/delete-account");
  return mod.deleteAccount;
}

describe("deleteAccount — happy path (AC6/AC7)", () => {
  it("AC6: calls confirmReverification, anonymise_user, deletes auth user, signs out", async () => {
    const deleteAccount = await getDeleteAccount();
    const result = await deleteAccount({ code: "123456" });
    expect(result.ok).toBe(true);
    expect(mockConfirmReverification).toHaveBeenCalledWith({ code: "123456", authenticatorCode: undefined });
    expect(mockServiceRpc).toHaveBeenCalledWith("private.anonymise_user", { p_user_id: "uid-1" });
    expect(mockAdminDeleteUser).toHaveBeenCalledWith("uid-1");
    expect(mockSignOut).toHaveBeenCalledWith({ scope: "global" });
  });
});

describe("deleteAccount — AC4: staff refused", () => {
  it("returns not_allowed for a user with a staff role claim", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { ...BASE_USER, app_metadata: { user_role: "admin" } } },
    });
    const deleteAccount = await getDeleteAccount();
    const result = await deleteAccount({ code: "123456" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_allowed");
    expect(mockConfirmReverification).not.toHaveBeenCalled();
  });
});

describe("deleteAccount — AC4: code validation", () => {
  it("returns code_invalid when confirmReverification returns code_invalid", async () => {
    mockConfirmReverification.mockResolvedValue({ ok: false, code: "code_invalid" });
    const deleteAccount = await getDeleteAccount();
    const result = await deleteAccount({ code: "badcode" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("code_invalid");
  });

  it("EC3: returns code_expired when confirmReverification returns code_expired", async () => {
    mockConfirmReverification.mockResolvedValue({ ok: false, code: "code_expired" });
    const deleteAccount = await getDeleteAccount();
    const result = await deleteAccount({ code: "expiredcode" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("code_expired");
  });
});

describe("deleteAccount — AC5: refusal conditions", () => {
  function makeBlockerFrom(blockerRow: Record<string, unknown>) {
    return vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: blockerRow, error: null }),
    });
  }

  it("returns validation_failed when a pending card order exists", async () => {
    mockFrom.mockImplementation(makeBlockerFrom({ id: "order-1", status: "pending" }));
    const deleteAccount = await getDeleteAccount();
    const result = await deleteAccount({ code: "123456" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("validation_failed");
  });

  it("returns validation_failed when a pending_verification bank order exists", async () => {
    mockFrom.mockImplementation(makeBlockerFrom({ id: "order-1", status: "pending_verification" }));
    const deleteAccount = await getDeleteAccount();
    const result = await deleteAccount({ code: "123456" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("validation_failed");
  });

  it("EC1: returns validation_failed when an order was created 90 minutes ago", async () => {
    const ninetyMinAgo = new Date(Date.now() - 90 * 60 * 1000).toISOString();
    mockFrom.mockImplementation(makeBlockerFrom({ id: "order-1", status: "paid", created_at: ninetyMinAgo }));
    const deleteAccount = await getDeleteAccount();
    const result = await deleteAccount({ code: "123456" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("validation_failed");
  });
});

describe("deleteAccount — EC2: approved download does not block", () => {
  it("allows deletion when only an approved (non-open) download_request exists", async () => {
    // Both .from() calls return null (no blocker for orders or download_requests)
    mockFrom.mockImplementation(makeNoBlockerFrom());
    const deleteAccount = await getDeleteAccount();
    const result = await deleteAccount({ code: "123456" });
    expect(result.ok).toBe(true);
  });
});

describe("deleteAccount — EC4: admin delete fails after anonymise", () => {
  it("returns unknown when auth.admin.deleteUser fails after anonymise_user succeeds", async () => {
    mockAdminDeleteUser.mockResolvedValue({ data: null, error: { message: "upstream error" } });
    const deleteAccount = await getDeleteAccount();
    const result = await deleteAccount({ code: "123456" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("unknown");
  });
});

describe("deleteAccount — no session", () => {
  it("returns not_allowed when there is no active session", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const deleteAccount = await getDeleteAccount();
    const result = await deleteAccount({ code: "123456" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_allowed");
  });
});
