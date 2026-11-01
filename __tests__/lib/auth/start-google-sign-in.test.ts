import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Supabase mock
// ---------------------------------------------------------------------------

const mockSignInWithOAuth = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { signInWithOAuth: mockSignInWithOAuth },
  })),
}));

// ---------------------------------------------------------------------------
// cookies mock
// ---------------------------------------------------------------------------

const mockCookiesSet = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    set: mockCookiesSet,
    get: vi.fn(),
    delete: vi.fn(),
  })),
}));

// ---------------------------------------------------------------------------
// config mock
// ---------------------------------------------------------------------------

vi.mock("@/lib/config", () => ({
  publicConfig: { appUrl: "https://ceylonsafety.com" },
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { startGoogleSignIn } from "@/lib/auth/actions/start-google-sign-in";

beforeEach(() => {
  vi.clearAllMocks();
  mockSignInWithOAuth.mockResolvedValue({
    data: { url: "https://accounts.google.com/o/oauth2/v2/auth?state=xyz" },
    error: null,
  });
});

// ---------------------------------------------------------------------------
// AC5 — happy path
// ---------------------------------------------------------------------------

describe("startGoogleSignIn — AC5 happy path", () => {
  it("returns ok:true with the Google OAuth URL", async () => {
    const result = await startGoogleSignIn({});
    expect(result).toEqual({
      ok: true,
      url: "https://accounts.google.com/o/oauth2/v2/auth?state=xyz",
    });
  });

  it("calls signInWithOAuth with provider:google and PKCE", async () => {
    await startGoogleSignIn({});
    expect(mockSignInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "google",
        options: expect.objectContaining({
          skipBrowserRedirect: true,
          redirectTo: "https://ceylonsafety.com/api/auth/callback",
        }),
      })
    );
  });

  it("sets the auth_next cookie when next is provided", async () => {
    await startGoogleSignIn({ next: "/purchases" });
    expect(mockCookiesSet).toHaveBeenCalledWith(
      "auth_next",
      "/purchases",
      expect.objectContaining({ httpOnly: true, sameSite: "lax" })
    );
  });

  it("uses maxAge of 15 minutes on the auth_next cookie", async () => {
    await startGoogleSignIn({ next: "/cart" });
    expect(mockCookiesSet).toHaveBeenCalledWith(
      "auth_next",
      "/cart",
      expect.objectContaining({ maxAge: 60 * 15 })
    );
  });

  it("does not set auth_next cookie when next is absent", async () => {
    await startGoogleSignIn({});
    expect(mockCookiesSet).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Error path
// ---------------------------------------------------------------------------

describe("startGoogleSignIn — error path", () => {
  it("returns ok:false when Supabase returns an error", async () => {
    mockSignInWithOAuth.mockResolvedValue({
      data: { url: null },
      error: { message: "OAuth error" },
    });
    const result = await startGoogleSignIn({});
    expect(result).toEqual({ ok: false, code: "unknown" });
  });

  it("returns ok:false when Supabase returns no URL", async () => {
    mockSignInWithOAuth.mockResolvedValue({
      data: { url: null },
      error: null,
    });
    const result = await startGoogleSignIn({});
    expect(result).toEqual({ ok: false, code: "unknown" });
  });

  it("rejects a next value over 2048 characters (validation)", async () => {
    const longNext = "/" + "a".repeat(2050);
    const result = await startGoogleSignIn({ next: longNext });
    expect(result).toEqual({ ok: false, code: "unknown" });
  });
});
