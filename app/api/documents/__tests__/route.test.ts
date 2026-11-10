// S-071 AC1: GET /api/documents unit tests — filters, pagination, error codes.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/documents/public", () => ({
  listPublicDocuments: vi.fn(),
}));

import { listPublicDocuments } from "@/lib/documents/public";
import { GET } from "@/app/api/documents/route";

const mockList = vi.mocked(listPublicDocuments);

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/documents");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url.toString());
}

beforeEach(() => vi.clearAllMocks());

describe("GET /api/documents — happy path (AC1)", () => {
  it("returns 200 with document list on success", async () => {
    mockList.mockResolvedValue({
      ok: true,
      data: { documents: [], total: 0, page: 1, pageSize: 12 },
    });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body).toHaveProperty("documents");
    expect(body).toHaveProperty("total");
    expect(body).toHaveProperty("page");
    expect(body).toHaveProperty("pageSize");
  });

  it("passes category, type, sort, page filters to listPublicDocuments", async () => {
    mockList.mockResolvedValue({
      ok: true,
      data: { documents: [], total: 0, page: 2, pageSize: 12 },
    });
    await GET(makeRequest({ category: "cat-uuid", type: "checklist", sort: "popular", page: "2" }));
    expect(mockList).toHaveBeenCalledWith({
      category: "cat-uuid",
      type: "checklist",
      sort: "popular",
      page: 2,
    });
  });

  it("EC4: passes empty filters when no query params — returns empty list, not error", async () => {
    mockList.mockResolvedValue({
      ok: true,
      data: { documents: [], total: 0, page: 1, pageSize: 12 },
    });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.documents).toEqual([]);
  });
});

describe("GET /api/documents — validation_failed (AC1)", () => {
  it("returns 400 with validation_failed for an unknown type value", async () => {
    mockList.mockResolvedValue({
      ok: false,
      code: "validation_failed",
      reason: "Invalid enum value",
    });
    const res = await GET(makeRequest({ type: "not_a_kind" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.code).toBe("validation_failed");
    expect(body).toHaveProperty("reason");
  });

  it("returns 400 for an invalid category UUID", async () => {
    mockList.mockResolvedValue({
      ok: false,
      code: "validation_failed",
      reason: "invalid category id",
    });
    const res = await GET(makeRequest({ category: "not-a-uuid" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("validation_failed");
  });
});

describe("GET /api/documents — unknown error", () => {
  it("returns 500 on unknown DB error", async () => {
    mockList.mockResolvedValue({ ok: false, code: "unknown" });
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });
});
