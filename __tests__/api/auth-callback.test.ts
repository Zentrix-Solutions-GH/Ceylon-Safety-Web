import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// AC5/AC6/EC1/EC2: /api/auth/callback route

const mockExchangeCodeForSession = vi.fn();
const mockGetUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      exchangeCodeForSession: mockExchangeCodeForSession,
      getUser: mockGetUser,
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

function makeRequest(code?: string): NextRequest {
  const url = code
    ? `http://localhost/api/auth/callback?code=${code}`
    : "http://localhost/api/auth/callback";
  return new NextRequest(url);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockExchangeCodeForSession.mockResolvedValue({
    data: { session: { user: { id: "u1" } } },
    error: null,
  });
  mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
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
  it("second exchange returns session already exists error — still redirects safely to localhost", async () => {
    // Supabase may return an error on second code exchange; the route should not crash
    mockExchangeCodeForSession.mockResolvedValueOnce({
      data: { session: null },
      error: { message: "Code already used", status: 400 },
    });
    // User may still be logged in from first callback
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });

    const req = makeRequest("abc123");
    const res = await GET(req);

    expect(res.status).toBe(307);
    // Must redirect to the same origin (safeNext enforces this)
    const location = res.headers.get("Location") ?? "";
    expect(location).toMatch(/^http:\/\/localhost/);
    expect(location).not.toMatch(/^https?:\/\/(?!localhost)/);
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
