import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// AC5/AC6/EC1/EC2: /api/auth/callback route

vi.mock("@/lib/resend/client", () => ({
  sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
}));

const mockExchangeCodeForSession = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      exchangeCodeForSession: mockExchangeCodeForSession,
    },
  })),
}));

const mockCookiesGet = vi.fn();
const mockCookiesDelete = vi.fn();
const mockCookiesSet = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: mockCookiesGet,
    set: mockCookiesSet,
    delete: mockCookiesDelete,
  })),
}));

import { GET } from "@/app/api/auth/callback/route";
import * as resendClient from "@/lib/resend/client";

function makeRequest(code?: string): NextRequest {
  const url = code
    ? `http://localhost/api/auth/callback?code=${code}`
    : "http://localhost/api/auth/callback";
  return new NextRequest(url);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockExchangeCodeForSession.mockResolvedValue({
    data: { session: { user: { id: "u1", email: "user@example.com" } } },
    error: null,
  });
  // Default: auth_next cookie present
  mockCookiesGet.mockImplementation((name: string) =>
    name === "auth_next" ? { value: "/purchases" } : undefined
  );
});

describe("GET /api/auth/callback — AC6 happy path", () => {
  it("exchanges code, reads and clears next cookie, redirects through safeNext", async () => {
    const req = makeRequest("abc123");
    const res = await GET(req);

    expect(mockExchangeCodeForSession).toHaveBeenCalledWith("abc123");
    expect(mockCookiesDelete).toHaveBeenCalledWith("auth_next");
    expect(res.status).toBe(307);
    expect(res.headers.get("Location")).toBe("http://localhost/purchases");
  });

  it("AC3: triggers sendWelcomeEmail with user email and id from session (Google callback path)", async () => {
    const req = makeRequest("abc123");
    await GET(req);
    // Allow the fire-and-forget to settle
    await new Promise((r) => setTimeout(r, 0));
    expect(resendClient.sendWelcomeEmail).toHaveBeenCalledWith("user@example.com", "u1");
  });

  it("redirects to / when auth_next cookie is missing (EC1)", async () => {
    mockCookiesGet.mockReturnValue(undefined);
    const req = makeRequest("abc123");
    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("Location")).toBe("http://localhost/");
  });

  it("safeNext rejects external URL in next cookie, redirects to /", async () => {
    mockCookiesGet.mockImplementation((name: string) =>
      name === "auth_next" ? { value: "https://evil.com" } : undefined
    );
    const req = makeRequest("abc123");
    const res = await GET(req);

    expect(res.headers.get("Location")).toBe("http://localhost/");
  });
});

describe("GET /api/auth/callback — EC2 double callback", () => {
  it("second exchange returns Supabase error — redirects to /?error=auth_failed without clearing next cookie", async () => {
    mockExchangeCodeForSession.mockResolvedValueOnce({
      data: { session: null },
      error: { message: "Code already used", status: 400 },
    });

    const req = makeRequest("abc123");
    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("Location")).toBe("http://localhost/?error=auth_failed");
    // auth_next cookie must NOT be cleared so the user can retry the Google flow
    expect(mockCookiesDelete).not.toHaveBeenCalledWith("auth_next");
  });
});

describe("GET /api/auth/callback — network error", () => {
  it("redirects to /?error=auth_failed when exchangeCodeForSession throws (network timeout)", async () => {
    mockExchangeCodeForSession.mockRejectedValueOnce(new Error("Network timeout"));
    const req = makeRequest("abc123");
    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("Location")).toBe("http://localhost/?error=auth_failed");
    // auth_next cookie must NOT be cleared so the user can retry
    expect(mockCookiesDelete).not.toHaveBeenCalledWith("auth_next");
  });
});

describe("GET /api/auth/callback — missing code", () => {
  it("redirects to / when no code query param present", async () => {
    const req = makeRequest();
    const res = await GET(req);

    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
    expect(res.status).toBe(307);
    expect(res.headers.get("Location")).toBe("http://localhost/");
  });
});
