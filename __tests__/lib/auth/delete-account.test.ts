// S-037: deleteAccount tests — AC4, AC5, AC6, AC7, EC1, EC2, EC3, EC4
// EC5 (concurrent calls) is out of scope for unit tests — idempotency is enforced
// by private.anonymise_user's FOR UPDATE lock at the database level (verified in pgTAP suite).

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

const mockRequireActiveAccount = vi.fn();
vi.mock("@/lib/auth/server", () => ({
  requireActiveAccount: (...args: unknown[]) => mockRequireActiveAccount(...args),
}));

const mockFrom = vi.fn();
const mockSignOut = vi.fn();
const mockAdminDeleteUser = vi.fn();
const mockServiceRpc = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({
    auth: { signOut: mockSignOut },
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

const ACTIVE_USER = {
  id: "uid-1",
  email: "user@example.com",
  claimedRole: undefined,
  hasAuthenticatorLevel: false,
  hasTotpEnrolled: false,
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

  mockRequireActiveAccount.mockResolvedValue({ ok: true, user: ACTIVE_USER });
  mockConfirmReverification.mockResolvedValue({ ok: true });
  mockSignOut.mockResolvedValue({ error: null });
  mockAdminDeleteUser.mockResolvedValue({ data: {}, error: null });
  mockServiceRpc.mockResolvedValue({ error: null });
  mockFrom.mockImplementation(makeNoBlockerFrom());
});

async function getDeleteAccount() {
  const mod = await import("@/lib/auth/actions/delete-account");
  return mod.deleteAccount;
}

describe("deleteAccount — happy path (AC6)", () => {
  it("AC6: calls confirmReverification, anonymise_user, deletes auth user", async () => {
    const deleteAccount = await getDeleteAccount();
    const result = await deleteAccount({ code: "123456" });
    expect(result.ok).toBe(true);
    expect(mockConfirmReverification).toHaveBeenCalledWith({ code: "123456", authenticatorCode: undefined });
    expect(mockServiceRpc).toHaveBeenCalledWith("private.anonymise_user", { p_user_id: "uid-1" });
    expect(mockAdminDeleteUser).toHaveBeenCalledWith("uid-1");
    // signOut is not called — adminDeleteUser already revokes all sessions
    expect(mockSignOut).not.toHaveBeenCalled();
  });
});

describe("deleteAccount — AC4: staff refused", () => {
  it("returns not_allowed for a user with a staff role claim", async () => {
    mockRequireActiveAccount.mockResolvedValue({ ok: true, user: { ...ACTIVE_USER, claimedRole: "admin" } });
    const deleteAccount = await getDeleteAccount();
    const result = await deleteAccount({ code: "123456" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_allowed");
    expect(mockConfirmReverification).not.toHaveBeenCalled();
  });
});

describe("deleteAccount — AC8: requireActiveAccount gate", () => {
  it("returns not_allowed when account is not active (no session)", async () => {
    mockRequireActiveAccount.mockResolvedValue({ ok: false, code: "reauth_required" });
    const deleteAccount = await getDeleteAccount();
    const result = await deleteAccount({ code: "123456" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_allowed");
  });

  it("returns not_allowed for a suspended user (profiles.status = suspended)", async () => {
    mockRequireActiveAccount.mockResolvedValue({ ok: false, code: "account_suspended" });
    const deleteAccount = await getDeleteAccount();
    const result = await deleteAccount({ code: "123456" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_allowed");
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

  it("AC5: returns validation_failed when an open download_request exists", async () => {
    // First call (orders): no blocker; second call (download_requests): status=open → blocks
    let callIndex = 0;
    mockFrom.mockImplementation(() => {
      const call = callIndex++;
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue(
          call === 0
            ? { data: null, error: null }                        // orders: no blocker
            : { data: { id: "dr-1", status: "open" }, error: null } // download_requests: blocks
        ),
      };
    });
    const deleteAccount = await getDeleteAccount();
    const result = await deleteAccount({ code: "123456" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("validation_failed");
  });
});

describe("deleteAccount — AC5: blocker query DB errors abort deletion", () => {
  function makeErrorFrom(pgError: Record<string, unknown>) {
    return vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: pgError }),
    });
  }

  it("returns unknown when the orders blocker query fails (DB transient error)", async () => {
    mockFrom.mockImplementation(makeErrorFrom({ message: "connection reset", code: "08006" }));
    const deleteAccount = await getDeleteAccount();
    const result = await deleteAccount({ code: "123456" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("unknown");
    expect(mockServiceRpc).not.toHaveBeenCalled();
  });

  it("returns unknown when the download_requests blocker query fails", async () => {
    let callIndex = 0;
    mockFrom.mockImplementation(() => {
      if (callIndex++ === 0) {
        // orders: no blocker
        return makeNoBlockerFrom()();
      }
      // download_requests: DB error
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: "timeout", code: "57014" } }),
      };
    });
    const deleteAccount = await getDeleteAccount();
    const result = await deleteAccount({ code: "123456" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("unknown");
    expect(mockServiceRpc).not.toHaveBeenCalled();
  });
});

describe("deleteAccount — EC2: approved download does not block", () => {
  it("allows deletion when no open download_request exists (approved is not blocking)", async () => {
    // Both from() calls return null — no blocker
    mockFrom.mockImplementation(makeNoBlockerFrom());
    const deleteAccount = await getDeleteAccount();
    const result = await deleteAccount({ code: "123456" });
    expect(result.ok).toBe(true);
  });
});

describe("deleteAccount — AC7: orders remain after deletion", () => {
  it("AC7: does not delete orders rows — anonymise_user is called but from('orders').delete is never called", async () => {
    const mockDelete = vi.fn();
    // Intercept the from() calls: orders chain gets a spy on delete; other calls return the no-blocker chain
    let callIndex = 0;
    mockFrom.mockImplementation((table: string) => {
      const noBlocker = makeNoBlockerFrom()();
      if (table === "orders") {
        callIndex++;
        return { ...noBlocker, delete: mockDelete };
      }
      return noBlocker;
    });

    const deleteAccount = await getDeleteAccount();
    await deleteAccount({ code: "123456" });

    // Confirm the service RPC (anonymise) was called — it owns order anonymisation
    expect(mockServiceRpc).toHaveBeenCalledWith("private.anonymise_user", { p_user_id: "uid-1" });
    // Confirm no direct delete was issued on the orders table via the server client
    expect(mockDelete).not.toHaveBeenCalled();
    expect(callIndex).toBeGreaterThan(0); // orders table was queried (AC5 check), proving the spy was active
  });
});

describe("deleteAccount — staff DB-level refusal (restrict_violation)", () => {
  it("returns not_allowed when anonymise_user raises restrict_violation (stale JWT, staff in DB)", async () => {
    mockServiceRpc.mockResolvedValue({ error: { code: "23001", message: "restrict_violation" } });
    const deleteAccount = await getDeleteAccount();
    const result = await deleteAccount({ code: "123456" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_allowed");
  });
});

describe("deleteAccount — EC4: admin delete fails after anonymise", () => {
  it("returns unknown; anonymise_user was called before the failure", async () => {
    mockAdminDeleteUser.mockResolvedValue({ data: null, error: { message: "upstream error" } });
    const deleteAccount = await getDeleteAccount();
    const result = await deleteAccount({ code: "123456" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("unknown");
    // Confirm anonymise ran before the admin delete failure (profile stays anonymised)
    expect(mockServiceRpc).toHaveBeenCalledWith("private.anonymise_user", { p_user_id: "uid-1" });
  });
});
