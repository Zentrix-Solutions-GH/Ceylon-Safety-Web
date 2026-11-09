// S-064: AC7 — GET /api/search route tests

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({
  serverConfig: { supabaseServiceRoleKey: "srk" },
  publicConfig: { supabaseUrl: "https://test.supabase.co", supabaseAnonKey: "anon" },
}));
vi.mock("@/lib/search/searchContent", () => ({
  searchContent: vi.fn(),
}));
vi.mock("@/lib/ratelimit/client-ip", () => ({
  getClientIp: vi.fn().mockReturnValue("1.2.3.4"),
}));

import { NextRequest } from "next/server";
import { searchContent } from "@/lib/search/searchContent";
import { GET } from "@/app/api/search/route";

// Next.js App Router returns 405 automatically for un-exported methods; we verify GET is exported.
// A missing export would cause a runtime error rather than a 405, so we assert GET is a function.
it("GET handler is exported (non-GET gets 405 from Next.js)", () => {
  expect(typeof GET).toBe("function");
});

const mockSearchContent = vi.mocked(searchContent);

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/search");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSearchContent.mockResolvedValue({ ok: true, data: [] });
});

describe("GET /api/search — AC7", () => {
  it("returns 200 with results on happy path", async () => {
    const rows = [
      {
        kind: "article" as const,
        id: "11111111-1111-4111-8111-111111111111",
        slug: "safety-first",
        title: "Safety First",
        shortText: "An excerpt",
        coverImageKey: "img/x.jpg",
        categoryName: "Safety",
      },
    ];
    mockSearchContent.mockResolvedValue({ ok: true, data: rows });
    const response = await GET(makeRequest({ scope: "home", q: "safety" }));
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.items).toHaveLength(1);
  });

  it("sets no-store cache control header", async () => {
    const response = await GET(makeRequest({ scope: "home", q: "safety" }));
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("returns 400 on validation_failed", async () => {
    mockSearchContent.mockResolvedValue({ ok: false, code: "validation_failed", field: "scope" });
    const response = await GET(makeRequest({ scope: "videos", q: "safety" }));
    expect(response.status).toBe(400);
  });

  it("returns 429 on rate_limited", async () => {
    mockSearchContent.mockResolvedValue({ ok: false, code: "rate_limited" });
    const response = await GET(makeRequest({ scope: "home", q: "safety" }));
    expect(response.status).toBe(429);
  });

  it("returns 500 on unknown error", async () => {
    mockSearchContent.mockResolvedValue({ ok: false, code: "unknown" });
    const response = await GET(makeRequest({ scope: "home", q: "safety" }));
    expect(response.status).toBe(500);
  });

  it("returns empty items on empty query", async () => {
    mockSearchContent.mockResolvedValue({ ok: true, data: [] });
    const response = await GET(makeRequest({ scope: "home", q: "" }));
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.items).toEqual([]);
  });
});
