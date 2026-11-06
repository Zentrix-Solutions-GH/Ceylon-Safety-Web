// S-050: auth gate integration tests — AC1, AC4, AC6
// Tests the actual route handlers to verify 401 is returned on auth failures.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({
  serverConfig: { supabaseServiceRoleKey: "srk" },
  publicConfig: { supabaseUrl: "https://test.supabase.co", supabaseAnonKey: "anon" },
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
  createSupabaseServiceRoleClient: vi.fn(),
  createSupabaseAnonClient: vi.fn(),
}));
vi.mock("@/lib/auth/server", () => ({
  requireActiveAccount: vi.fn(),
  getCurrentUser: vi.fn(),
}));
vi.mock("@/lib/engagement/toggleLike", () => ({
  toggleLike: vi.fn(),
  getLikeStatus: vi.fn(),
}));
vi.mock("@/lib/engagement/postComment", () => ({
  postComment: vi.fn(),
}));
vi.mock("@/lib/engagement/listComments", () => ({
  listComments: vi.fn(),
  listMyComments: vi.fn(),
}));

import { requireActiveAccount } from "@/lib/auth/server";
import { POST as likesPost } from "@/app/api/likes/route";
import { POST as commentsPost, GET as commentsGet } from "@/app/api/comments/route";

function mockAuth(code: "reauth_required" | "account_suspended") {
  (requireActiveAccount as ReturnType<typeof vi.fn>).mockResolvedValue({
    ok: false,
    code,
  });
}

const ARTICLE_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

function makePost(url: string, body: unknown): NextRequest {
  const json = JSON.stringify(body);
  return new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json", "content-length": String(json.length) },
    body: json,
  });
}

describe("POST /api/likes auth gate (AC1)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 reauth_required for unauthenticated request", async () => {
    mockAuth("reauth_required");
    const req = makePost("http://localhost/api/likes", { kind: "article", id: ARTICLE_ID });
    const res = await likesPost(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("reauth_required");
  });

  it("returns 401 account_suspended for suspended user (AC6)", async () => {
    mockAuth("account_suspended");
    const req = makePost("http://localhost/api/likes", { kind: "article", id: ARTICLE_ID });
    const res = await likesPost(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("account_suspended");
  });
});

describe("POST /api/comments auth gate (AC4)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 reauth_required for unauthenticated request", async () => {
    mockAuth("reauth_required");
    const req = makePost("http://localhost/api/comments", { kind: "article", id: ARTICLE_ID, text: "Hello" });
    const res = await commentsPost(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("reauth_required");
  });

  it("returns 401 account_suspended for suspended user (AC6)", async () => {
    mockAuth("account_suspended");
    const req = makePost("http://localhost/api/comments", { kind: "article", id: ARTICLE_ID, text: "Hello" });
    const res = await commentsPost(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("account_suspended");
  });
});

describe("GET /api/comments?mine=1 auth gate (AC8)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 reauth_required for unauthenticated request", async () => {
    mockAuth("reauth_required");
    const req = new NextRequest(
      `http://localhost/api/comments?kind=article&id=${ARTICLE_ID}&mine=1`
    );
    const res = await commentsGet(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("reauth_required");
  });
});

// ─── Body-size guard (AC11) ───────────────────────────────────────────────────
// The Content-Length guard fires before auth, so no mock needed.

describe("POST /api/likes body-size guard (AC11)", () => {
  it("returns 413 when Content-Length exceeds 512 bytes", async () => {
    const oversized = "x".repeat(600);
    const req = new NextRequest("http://localhost/api/likes", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": String(oversized.length) },
      body: oversized,
    });
    const res = await likesPost(req);
    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.error).toBe("validation_failed");
  });
});

describe("POST /api/comments body-size guard (AC11)", () => {
  it("returns 413 when Content-Length exceeds 3072 bytes", async () => {
    const oversized = "x".repeat(4000);
    const req = new NextRequest("http://localhost/api/comments", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": String(oversized.length) },
      body: oversized,
    });
    const res = await commentsPost(req);
    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.error).toBe("validation_failed");
  });
});

// ─── kind=video refusal (AC1) ─────────────────────────────────────────────────
// Zod z.enum(["article"]) must refuse "video" before any auth check.

describe("POST /api/likes kind=video refusal (AC1)", () => {
  it("returns 400 validation_failed for kind=video", async () => {
    // Auth gate comes after body parsing; mock auth to pass so validation is reached.
    (requireActiveAccount as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, userId: "u-1" });
    const req = makePost("http://localhost/api/likes", { kind: "video", id: ARTICLE_ID });
    const res = await likesPost(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("validation_failed");
  });
});

describe("POST /api/comments kind=video refusal (AC1)", () => {
  it("returns 400 validation_failed for kind=video", async () => {
    (requireActiveAccount as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, userId: "u-1" });
    const req = makePost("http://localhost/api/comments", { kind: "video", id: ARTICLE_ID, text: "Hello" });
    const res = await commentsPost(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("validation_failed");
  });
});
