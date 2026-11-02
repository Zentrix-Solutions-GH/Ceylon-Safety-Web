import { describe, it, expect, vi, beforeEach } from "vitest";

// AC7: signOut — this device or all devices

const mockSignOut = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { signOut: mockSignOut },
  })),
}));

const mockCookiesDelete = vi.fn();
const mockCookiesSet = vi.fn();
const mockCookiesGet = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    set: mockCookiesSet,
    get: mockCookiesGet,
    delete: mockCookiesDelete,
  })),
}));

import { signOut } from "@/lib/auth/actions/sign-out";

beforeEach(() => {
  vi.clearAllMocks();
  mockSignOut.mockResolvedValue({ error: null });
});

describe("signOut — AC7", () => {
  it("calls supabase.auth.signOut with scope:local for 'this'", async () => {
    const result = await signOut({ scope: "this" });
    expect(result).toEqual({ ok: true });
    expect(mockSignOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("calls supabase.auth.signOut with scope:global for 'all'", async () => {
    const result = await signOut({ scope: "all" });
    expect(result).toEqual({ ok: true });
    expect(mockSignOut).toHaveBeenCalledWith({ scope: "global" });
  });

  it("clears app-managed cookies (pending_signup and auth_next) on success", async () => {
    await signOut({ scope: "this" });
    // clearPendingSignup deletes "pending_signup"; clearNextCookie deletes "auth_next"
    expect(mockCookiesDelete).toHaveBeenCalledWith("pending_signup");
    expect(mockCookiesDelete).toHaveBeenCalledWith("auth_next");
  });

  it("returns ok:false on Supabase error", async () => {
    mockSignOut.mockResolvedValue({ error: { message: "Server error" } });
    const result = await signOut({ scope: "this" });
    expect(result).toMatchObject({ ok: false, code: "unknown" });
  });
});
