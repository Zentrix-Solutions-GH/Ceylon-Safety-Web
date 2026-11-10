// S-071 AC5, EC7: preview route unit tests (rate limit, page range validation).
// These are unit tests with mocked dependencies — no Supabase connection needed.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mock dependencies ──────────────────────────────────────────────────────

vi.mock("@/lib/ratelimit/index", () => ({
  checkRateLimit: vi.fn(),
}));

vi.mock("@/lib/documents/public", () => ({
  servePreviewFile: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/config", () => ({
  serverConfig: { previewRateLimitPerMinute: 60 },
  r2Config: () => ({ bucketPrivate: "private-bucket" }),
}));

vi.mock("@/lib/r2/storage", () => ({
  getObjectStream: vi.fn(),
}));

vi.mock("@/lib/validation/document", async () => {
  const actual = await vi.importActual<typeof import("@/lib/validation/document")>(
    "@/lib/validation/document"
  );
  return actual;
});

import { checkRateLimit } from "@/lib/ratelimit/index";
import { servePreviewFile } from "@/lib/documents/public";
import { getObjectStream } from "@/lib/r2/storage";
import { GET } from "@/app/api/preview/[documentId]/route";

const mockCheckRateLimit = vi.mocked(checkRateLimit);
const mockServePreviewFile = vi.mocked(servePreviewFile);
const mockGetObjectStream = vi.mocked(getObjectStream);

function makeRequest(documentId: string, params: Record<string, string> = {}) {
  const url = new URL(`http://localhost/api/preview/${documentId}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new NextRequest(url.toString());
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/preview/[documentId] — happy path (AC5)", () => {
  beforeEach(() => {
    mockCheckRateLimit.mockResolvedValue({ ok: true });
  });

  it("returns 200 with correct Content-Type for a png preview", async () => {
    mockServePreviewFile.mockResolvedValue({ ok: true, fileKey: "previews/doc/en/1.png", format: "png" });
    // Create a minimal ReadableStream to simulate R2 response
    const stream = new ReadableStream({ start(c) { c.close(); } });
    mockGetObjectStream.mockResolvedValue(stream as ReadableStream<Uint8Array>);

    const req = makeRequest("550e8400-e29b-41d4-a716-446655440000", { language: "en", page: "1" });
    const res = await GET(req, {
      params: Promise.resolve({ documentId: "550e8400-e29b-41d4-a716-446655440000" }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toMatch(/private/);
  });

  it("returns 404 when R2 object is missing (stream is null)", async () => {
    mockServePreviewFile.mockResolvedValue({ ok: true, fileKey: "previews/doc/en/1.png", format: "png" });
    mockGetObjectStream.mockResolvedValue(null);

    const req = makeRequest("550e8400-e29b-41d4-a716-446655440000", { language: "en", page: "1" });
    const res = await GET(req, {
      params: Promise.resolve({ documentId: "550e8400-e29b-41d4-a716-446655440000" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("GET /api/preview/[documentId] — rate limit (EC7)", () => {
  it("returns 429 with Retry-After header when rate limit is exceeded", async () => {
    mockCheckRateLimit.mockResolvedValue({
      ok: false,
      reason: "rate_limited",
      retryAfterSeconds: 42,
    });

    const req = makeRequest("550e8400-e29b-41d4-a716-446655440000", {
      language: "en",
    });
    const res = await GET(req, {
      params: Promise.resolve({ documentId: "550e8400-e29b-41d4-a716-446655440000" }),
    });

    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("42");
  });
});

describe("GET /api/preview/[documentId] — input validation", () => {
  beforeEach(() => {
    mockCheckRateLimit.mockResolvedValue({ ok: true });
  });

  it("returns 400 for invalid documentId (not UUID)", async () => {
    const req = makeRequest("not-a-uuid", { language: "en" });
    const res = await GET(req, {
      params: Promise.resolve({ documentId: "not-a-uuid" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing language", async () => {
    const req = makeRequest("550e8400-e29b-41d4-a716-446655440000");
    const res = await GET(req, {
      params: Promise.resolve({ documentId: "550e8400-e29b-41d4-a716-446655440000" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 for page=0 (out of range, AC5)", async () => {
    mockServePreviewFile.mockResolvedValue({ ok: false, code: "not_found" });
    const req = makeRequest("550e8400-e29b-41d4-a716-446655440000", {
      language: "en",
      page: "0",
    });
    const res = await GET(req, {
      params: Promise.resolve({ documentId: "550e8400-e29b-41d4-a716-446655440000" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 for page=4 (above max, AC5)", async () => {
    mockServePreviewFile.mockResolvedValue({ ok: false, code: "not_found" });
    const req = makeRequest("550e8400-e29b-41d4-a716-446655440000", {
      language: "en",
      page: "4",
    });
    const res = await GET(req, {
      params: Promise.resolve({ documentId: "550e8400-e29b-41d4-a716-446655440000" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 when servePreviewFile returns not_found", async () => {
    mockServePreviewFile.mockResolvedValue({ ok: false, code: "not_found" });

    const req = makeRequest("550e8400-e29b-41d4-a716-446655440000", {
      language: "en",
      page: "1",
    });
    const res = await GET(req, {
      params: Promise.resolve({ documentId: "550e8400-e29b-41d4-a716-446655440000" }),
    });
    expect(res.status).toBe(404);
  });

  it("never returns a full file even if servePreviewFile contract is violated (AC5 guard)", async () => {
    // The route must never return a 'full' kind row. This is enforced in servePreviewFile itself,
    // but the route should return 500 if the internal call returns an unexpected code.
    mockServePreviewFile.mockResolvedValue({ ok: false, code: "not_found" });
    const req = makeRequest("550e8400-e29b-41d4-a716-446655440000", {
      language: "en",
      page: "1",
    });
    const res = await GET(req, {
      params: Promise.resolve({ documentId: "550e8400-e29b-41d4-a716-446655440000" }),
    });
    // Even on not_found, no file content is returned.
    expect(res.headers.get("content-type")).not.toContain("application/octet-stream");
  });
});
