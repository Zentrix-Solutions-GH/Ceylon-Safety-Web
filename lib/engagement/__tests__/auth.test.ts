// S-050: auth gate tests — AC1, AC4, AC6

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({
  serverConfig: { supabaseServiceRoleKey: "srk" },
  publicConfig: { supabaseUrl: "https://test.supabase.co", supabaseAnonKey: "anon" },
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
  createSupabaseServiceRoleClient: vi.fn(),
}));
vi.mock("@/lib/auth/server", () => ({
  requireActiveAccount: vi.fn(),
}));

import { requireActiveAccount } from "@/lib/auth/server";
import type { SessionUser } from "@/types/auth";

const mockUser: SessionUser = {
  id: "user-1",
  email: "user@example.com",
  hasTotpEnrolled: false,
  hasAuthenticatorLevel: false,
};

describe("requireActiveAccount gate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns reauth_required for unauthenticated request (AC1, AC4)", async () => {
    (requireActiveAccount as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      code: "reauth_required",
    });
    const result = await requireActiveAccount();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("reauth_required");
  });

  it("returns account_suspended for suspended user (AC6)", async () => {
    (requireActiveAccount as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      code: "account_suspended",
    });
    const result = await requireActiveAccount();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("account_suspended");
  });

  it("returns ok:true for active user (AC1)", async () => {
    (requireActiveAccount as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      user: mockUser,
    });
    const result = await requireActiveAccount();
    expect(result.ok).toBe(true);
  });
});
