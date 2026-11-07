import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/articles/listArticles", () => ({
  listArticles: vi.fn(),
}));

import { listArticles } from "@/lib/articles/listArticles";
import { GET } from "@/app/api/articles/route";

const mockListArticles = vi.mocked(listArticles);

function makeRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost/api/articles");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url.toString());
}

beforeEach(() => {
  mockListArticles.mockReset();
});

describe("GET /api/articles", () => {
  it("returns first page of articles", async () => {
    mockListArticles.mockResolvedValue({
      ok: true,
      data: {
        items: [
          {
            id: "1",
            slug: "a",
            title: "A",
            excerpt: null,
            coverImageKey: null,
            coverImageAlt: null,
            category: { id: "c1", name: "Safety", slug: "safety" },
            authorName: "Author",
            publishedAt: "2026-01-01T00:00:00Z",
            likeCount: 0,
            commentCount: 0,
          },
        ],
        next: null,
      },
    });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.items).toHaveLength(1);
    expect(json.items[0].slug).toBe("a");
    expect(json.next).toBeNull();
  });

  it("forwards range and category params to listArticles", async () => {
    mockListArticles.mockResolvedValue({ ok: true, data: { items: [], next: null } });
    await GET(makeRequest({ range: "week", category: "safety" }));
    expect(mockListArticles).toHaveBeenCalledWith(
      expect.objectContaining({ range: "week", category: "safety" })
    );
  });

  it("forwards cursor param to listArticles", async () => {
    mockListArticles.mockResolvedValue({ ok: true, data: { items: [], next: null } });
    const cursor = { publishedAt: "2026-01-01T00:00:00.000Z", id: "abc-123" };
    await GET(makeRequest({ cursor: JSON.stringify(cursor) }));
    expect(mockListArticles).toHaveBeenCalledWith(
      expect.objectContaining({ cursor })
    );
  });

  it("returns 400 for malformed cursor", async () => {
    mockListArticles.mockResolvedValue({
      ok: false,
      code: "validation_failed",
      reason: "Invalid cursor",
    });
    const res = await GET(makeRequest({ cursor: "not-json" }));
    expect(res.status).toBe(400);
  });

  it("returns 500 when listArticles returns unknown error", async () => {
    mockListArticles.mockResolvedValue({ ok: false, code: "unknown" });
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
  });
});
