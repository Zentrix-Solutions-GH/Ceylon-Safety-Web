// S-064: searchContent unit tests

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({
  serverConfig: { supabaseServiceRoleKey: "srk" },
  publicConfig: { supabaseUrl: "https://test.supabase.co", supabaseAnonKey: "anon" },
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAnonClient: vi.fn(),
}));
vi.mock("@/lib/ratelimit/index", () => ({
  checkRateLimit: vi.fn(),
}));

import { createSupabaseAnonClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/ratelimit/index";
import { searchContent } from "@/lib/search/searchContent";

const mockCheckRateLimit = vi.mocked(checkRateLimit);
const mockCreateClient = vi.mocked(createSupabaseAnonClient);

function makeRpcClient(rows: unknown[] = [], error: unknown = null) {
  const rpc = vi.fn().mockResolvedValue({ data: rows, error });
  return { rpc } as unknown as ReturnType<typeof createSupabaseAnonClient>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRateLimit.mockResolvedValue({ ok: true });
  mockCreateClient.mockReturnValue(makeRpcClient([]));
});

// ── AC1: scope validation ────────────────────────────────────────────────────

describe("AC1 — scope validation", () => {
  it("accepts scope=home", async () => {
    const result = await searchContent({ scope: "home", query: "safety" }, "1.2.3.4");
    expect(result.ok).toBe(true);
  });

  it("accepts scope=articles", async () => {
    const result = await searchContent({ scope: "articles", query: "safety" }, "1.2.3.4");
    expect(result.ok).toBe(true);
  });

  it("accepts scope=documents", async () => {
    const result = await searchContent({ scope: "documents", query: "safety" }, "1.2.3.4");
    expect(result.ok).toBe(true);
  });

  it("rejects unknown scope", async () => {
    const result = await searchContent(
      { scope: "videos" as "home", query: "safety" },
      "1.2.3.4"
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("validation_failed");
      expect(result.field).toBe("scope");
    }
  });

  it("maps home scope to 'all' when calling rpc", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    mockCreateClient.mockReturnValue({ rpc } as unknown as ReturnType<typeof createSupabaseAnonClient>);
    await searchContent({ scope: "home", query: "safety" }, "1.2.3.4");
    expect(rpc).toHaveBeenCalledWith("search_all", expect.objectContaining({ scope: "all" }));
  });
});

// ── AC2: query validation ────────────────────────────────────────────────────

describe("AC2 — query validation", () => {
  it("rejects query over 100 characters", async () => {
    const longQuery = "a".repeat(101);
    const result = await searchContent({ scope: "home", query: longQuery }, "1.2.3.4");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("validation_failed");
      expect(result.field).toBe("query");
    }
  });

  it("accepts query of exactly 100 characters", async () => {
    const query = "a".repeat(100);
    const result = await searchContent({ scope: "home", query }, "1.2.3.4");
    expect(result.ok).toBe(true);
  });

  it("trims whitespace before length check — 101 chars after trim fails", async () => {
    const query = "  " + "a".repeat(101) + "  ";
    const result = await searchContent({ scope: "home", query }, "1.2.3.4");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("validation_failed");
  });
});

// ── EC1: empty / whitespace query ───────────────────────────────────────────

describe("EC1 — empty query returns empty result without DB call", () => {
  it("empty string returns empty items", async () => {
    const rpc = vi.fn();
    mockCreateClient.mockReturnValue({ rpc } as unknown as ReturnType<typeof createSupabaseAnonClient>);
    const result = await searchContent({ scope: "home", query: "" }, "1.2.3.4");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual([]);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("whitespace-only query returns empty items without DB call", async () => {
    const rpc = vi.fn();
    mockCreateClient.mockReturnValue({ rpc } as unknown as ReturnType<typeof createSupabaseAnonClient>);
    const result = await searchContent({ scope: "home", query: "   " }, "1.2.3.4");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual([]);
    expect(rpc).not.toHaveBeenCalled();
  });
});

// ── EC2: injection / special characters ─────────────────────────────────────

describe("EC2 — injection-like queries are handled safely", () => {
  it("query with SQL-like text does not error", async () => {
    const result = await searchContent(
      { scope: "home", query: "'; DROP TABLE articles; --" },
      "1.2.3.4"
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(Array.isArray(result.data)).toBe(true);
  });

  it("query with <script> text does not error", async () => {
    const result = await searchContent(
      { scope: "home", query: "<script>alert(1)</script>" },
      "1.2.3.4"
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(Array.isArray(result.data)).toBe(true);
  });

  it("query with null byte is handled", async () => {
    const result = await searchContent({ scope: "home", query: "safe\0ty" }, "1.2.3.4");
    expect(result.ok).toBe(true);
    if (result.ok) expect(Array.isArray(result.data)).toBe(true);
  });
});

// ── EC3: non-Latin scripts ───────────────────────────────────────────────────

describe("EC3 — Sinhala/Tamil query does not error", () => {
  it("Sinhala query returns ok result", async () => {
    const result = await searchContent({ scope: "home", query: "ආරක්ෂාව" }, "1.2.3.4");
    expect(result.ok).toBe(true);
    if (result.ok) expect(Array.isArray(result.data)).toBe(true);
  });

  it("Tamil query returns ok result", async () => {
    const result = await searchContent({ scope: "home", query: "பாதுகாப்பு" }, "1.2.3.4");
    expect(result.ok).toBe(true);
    if (result.ok) expect(Array.isArray(result.data)).toBe(true);
  });
});

// ── EC4: stop-words-only query ───────────────────────────────────────────────

describe("EC4 — stop-words-only query returns empty result", () => {
  it("query of only English stop words returns ok with empty array", async () => {
    // The DB function wraps websearch_to_tsquery in EXCEPTION → RETURN (empty);
    // at the unit level the rpc returns [] which mapRow turns into [].
    const result = await searchContent({ scope: "home", query: "the and or is" }, "1.2.3.4");
    expect(result.ok).toBe(true);
    if (result.ok) expect(Array.isArray(result.data)).toBe(true);
  });
});

// ── AC5: rate limit ──────────────────────────────────────────────────────────

describe("AC5 — rate limit", () => {
  it("returns rate_limited when limiter refuses", async () => {
    mockCheckRateLimit.mockResolvedValue({ ok: false, reason: "rate_limited" });
    const result = await searchContent({ scope: "home", query: "safety" }, "1.2.3.4");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("rate_limited");
  });

  it("calls checkRateLimit with correct params", async () => {
    await searchContent({ scope: "home", query: "safety" }, "5.6.7.8");
    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        limitName: "search",
        maxCount: 30,
        windowSeconds: 60,
        mode: "open",
        key: "5.6.7.8",
      })
    );
  });
});

// ── AC6: result shape ────────────────────────────────────────────────────────

describe("AC6 — result shape", () => {
  it("returns required fields for each result item", async () => {
    const rows = [
      {
        kind: "article",
        id: "11111111-1111-4111-8111-111111111111",
        slug: "test-article",
        title: "Test Article",
        short_text: "An excerpt",
        cover_image_key: "images/test.jpg",
        category_name: "Safety",
      },
    ];
    mockCreateClient.mockReturnValue(makeRpcClient(rows));
    const result = await searchContent({ scope: "home", query: "test" }, "1.2.3.4");
    expect(result.ok).toBe(true);
    if (result.ok && result.data) {
      const item = result.data[0];
      expect(item).toHaveProperty("kind");
      expect(item).toHaveProperty("id");
      expect(item).toHaveProperty("slug");
      expect(item).toHaveProperty("title");
      expect(item).toHaveProperty("shortText");
      expect(item).toHaveProperty("coverImageKey");
      expect(item).toHaveProperty("categoryName");
      expect(item).not.toHaveProperty("fileKey");
    }
  });

  it("document result never carries file_key", async () => {
    const rows = [
      {
        kind: "document",
        id: "22222222-2222-4222-8222-222222222222",
        slug: "safety-checklist",
        title: "Safety Checklist",
        short_text: "A document desc",
        cover_image_key: "docs/cover.jpg",
        category_name: "Documents",
        file_key: "private/file.pptx",
      },
    ];
    mockCreateClient.mockReturnValue(makeRpcClient(rows));
    const result = await searchContent({ scope: "documents", query: "safety" }, "1.2.3.4");
    expect(result.ok).toBe(true);
    if (result.ok && result.data) {
      expect(result.data[0]).not.toHaveProperty("fileKey");
      expect(result.data[0]).not.toHaveProperty("file_key");
    }
  });
});

// ── EC7: statement timeout ───────────────────────────────────────────────────

describe("EC7 — statement timeout", () => {
  it("returns unknown when DB returns statement timeout error code", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "57014", message: "canceling statement due to statement timeout" },
    });
    mockCreateClient.mockReturnValue({ rpc } as unknown as ReturnType<typeof createSupabaseAnonClient>);
    const result = await searchContent({ scope: "home", query: "safety" }, "1.2.3.4");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("unknown");
  });
});

// ── General DB error ─────────────────────────────────────────────────────────

describe("DB error handling", () => {
  it("returns unknown on unexpected DB error", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "PGRST301", message: "some db error" },
    });
    mockCreateClient.mockReturnValue({ rpc } as unknown as ReturnType<typeof createSupabaseAnonClient>);
    const result = await searchContent({ scope: "home", query: "safety" }, "1.2.3.4");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("unknown");
  });
});
