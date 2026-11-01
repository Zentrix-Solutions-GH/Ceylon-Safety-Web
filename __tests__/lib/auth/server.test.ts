import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Supabase mock factory ---
// Each test configures what the mock returns by setting mockSupabase.*
const mockGetUser = vi.fn();
const mockRpc = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    rpc: mockRpc,
    from: mockFrom,
  })),
  createSupabaseServiceRoleClient: vi.fn(() => ({
    rpc: mockRpc,
  })),
}));

import { getCurrentUser, requireUser, requireActiveAccount } from "@/lib/auth/server";

const ACTIVE_USER = {
  id: "user-1",
  email: "user@example.com",
  app_metadata: {},
  user_metadata: {},
  aud: "authenticated",
  created_at: new Date().toISOString(),
};

const ACTIVE_PROFILE = { id: "user-1", status: "active" };

function makeSelectMock(data: object | null, error: object | null = null) {
  return vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({ data, error }),
      })),
    })),
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getCurrentUser", () => {
  it("returns the verified user when a valid session exists", async () => {
    mockGetUser.mockResolvedValue({ data: { user: ACTIVE_USER }, error: null });

    const user = await getCurrentUser();

    expect(user).toMatchObject({ id: "user-1" });
  });

  it("returns null when there is no session", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const user = await getCurrentUser();

    expect(user).toBeNull();
  });

  it("returns null on Supabase auth error", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "jwt expired" },
    });

    const user = await getCurrentUser();

    expect(user).toBeNull();
  });
});

describe("requireUser (action/API context)", () => {
  it("returns the user when signed in with an existing profile", async () => {
    mockGetUser.mockResolvedValue({ data: { user: ACTIVE_USER }, error: null });
    mockFrom.mockImplementation(makeSelectMock(ACTIVE_PROFILE));

    const result = await requireUser();

    expect(result).toMatchObject({ ok: true });
    if (result.ok) expect(result.user.id).toBe("user-1");
  });

  it("returns reauth_required when there is no session (action mode)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await requireUser();

    expect(result).toEqual({ ok: false, code: "reauth_required" });
  });

  it("creates a profile row when none exists (AC2)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: ACTIVE_USER }, error: null });
    // First call: no profile found; second call: profile created
    let callCount = 0;
    mockFrom.mockImplementation(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue(
            callCount++ === 0
              ? { data: null, error: { code: "PGRST116" } }
              : { data: ACTIVE_PROFILE, error: null }
          ),
        })),
      })),
    }));
    mockRpc.mockResolvedValue({ data: null, error: null });

    const result = await requireUser();

    expect(mockRpc).toHaveBeenCalled();
    expect(result).toMatchObject({ ok: true });
  });
});

describe("requireActiveAccount (action context)", () => {
  it("returns ok for an active user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: ACTIVE_USER }, error: null });
    mockFrom.mockImplementation(makeSelectMock(ACTIVE_PROFILE));

    const result = await requireActiveAccount();

    expect(result).toMatchObject({ ok: true });
  });

  it("returns account_suspended when profile status is suspended (AC3)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: ACTIVE_USER }, error: null });
    mockFrom.mockImplementation(makeSelectMock({ id: "user-1", status: "suspended" }));

    const result = await requireActiveAccount();

    expect(result).toEqual({ ok: false, code: "account_suspended" });
  });

  it("returns reauth_required for a signed-out caller", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await requireActiveAccount();

    expect(result).toEqual({ ok: false, code: "reauth_required" });
  });
});
