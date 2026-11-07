// S-050: toggleLike — AC1, AC2, AC3, EC5

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

import { createSupabaseServiceRoleClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { toggleLike, getLikeStatus } from "@/lib/engagement/toggleLike";

function makeServiceClient(overrides: Record<string, unknown> = {}) {
  const rpcResult = overrides.rpcResult ?? { data: null, error: null };
  const deleteResult = overrides.deleteResult ?? { data: null, error: null };

  const eqMock = vi.fn().mockReturnThis();
  const singleMock = vi.fn().mockResolvedValue({ data: { article_id: "art-1", user_id: "u-1" }, error: null });

  // Service role client — articles read + count read + article_likes read (getLikeStatus)
  const serviceChain: Record<string, unknown> = {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "articles") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue(
                overrides.articleResult ?? { data: { like_count: 3, status: "published", published_at: "2026-01-01", deleted_at: null }, error: null }
              ),
            }),
          }),
        };
      }
      if (table === "article_likes") {
        // Used by getLikeStatus (which uses service role for reads)
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue(
                  overrides.existingLike !== undefined
                    ? { data: overrides.existingLike, error: null }
                    : { data: null, error: null }
                ),
              }),
            }),
          }),
        };
      }
      return { select: vi.fn().mockReturnThis(), eq: eqMock, single: singleMock };
    }),
    rpc: vi.fn().mockResolvedValue(rpcResult),
  };

  // Server (user-scoped) client — article_likes read + write
  const serverChain: Record<string, unknown> = {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "article_likes") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue(
                  overrides.existingLike !== undefined
                    ? { data: overrides.existingLike, error: null }
                    : { data: null, error: null }
                ),
              }),
            }),
          }),
          insert: vi.fn().mockResolvedValue(
            overrides.insertError
              ? { data: null, error: overrides.insertError }
              : { data: null, error: null }
          ),
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue(deleteResult),
            }),
          }),
        };
      }
      return { select: vi.fn().mockReturnThis(), eq: eqMock, single: singleMock };
    }),
  };

  (createSupabaseServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(serviceChain);
  (createSupabaseServerClient as ReturnType<typeof vi.fn>).mockResolvedValue(serverChain);
  return { serviceChain, serverChain };
}

describe("toggleLike", () => {
  beforeEach(() => vi.clearAllMocks());

  it("adds a like when none exists and returns liked=true (AC1)", async () => {
    makeServiceClient({ existingLike: null });
    const result = await toggleLike("user-1", "article-1");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.liked).toBe(true);
  });

  it("removes a like when one exists and returns liked=false (AC1, EC5)", async () => {
    makeServiceClient({ existingLike: { article_id: "article-1", user_id: "user-1" } });
    const result = await toggleLike("user-1", "article-1");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.liked).toBe(false);
  });

  it("returns rate_limited when DB triggers hourly limit (AC3)", async () => {
    makeServiceClient({
      existingLike: null,
      insertError: { code: "23000", message: "ceylonsafety: rate_limited reason=hourly" },
      articleResult: { data: { like_count: 60, status: "published", published_at: "2026-01-01", deleted_at: null }, error: null },
    });
    const result = await toggleLike("user-1", "article-1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("rate_limited");
  });

  it("returns liked=true on concurrent insert race (23505 unique violation — EC5)", async () => {
    // Simulates two simultaneous POSTs: this one loses the race (23505), but the
    // like now exists so the correct response is liked=true with the current count.
    makeServiceClient({
      existingLike: null,
      insertError: { code: "23505", message: "duplicate key value violates unique constraint" },
      articleResult: { data: { like_count: 5, status: "published", published_at: "2026-01-01", deleted_at: null }, error: null },
    });
    const result = await toggleLike("user-1", "article-1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.liked).toBe(true);
      expect(result.count).toBe(5);
    }
  });

  it("returns not_allowed for hidden article (AC1)", async () => {
    makeServiceClient({
      existingLike: null,
      articleResult: { data: { like_count: 0, status: "draft", published_at: null, deleted_at: null }, error: null },
    });
    const result = await toggleLike("user-1", "article-1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_allowed");
  });

  it("returns not_allowed for deleted article (AC1)", async () => {
    makeServiceClient({
      existingLike: null,
      articleResult: { data: { like_count: 0, status: "published", published_at: "2026-01-01", deleted_at: "2026-10-01" }, error: null },
    });
    const result = await toggleLike("user-1", "article-1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_allowed");
  });

  it("returns unknown on delete DB error", async () => {
    const serviceChain: Record<string, unknown> = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "articles") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { like_count: 3, status: "published", published_at: "2026-01-01", deleted_at: null },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      }),
    };
    const serverChain: Record<string, unknown> = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "article_likes") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { article_id: "article-1", user_id: "user-1" }, error: null,
                  }),
                }),
              }),
            }),
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ error: { message: "db error" } }),
              }),
            }),
          };
        }
        return {};
      }),
    };
    (createSupabaseServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(serviceChain);
    (createSupabaseServerClient as ReturnType<typeof vi.fn>).mockResolvedValue(serverChain);
    const result = await toggleLike("user-1", "article-1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("unknown");
  });

  it("returns not_allowed for future-dated article (AC1)", async () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    makeServiceClient({
      existingLike: null,
      articleResult: { data: { like_count: 0, status: "published", published_at: future, deleted_at: null }, error: null },
    });
    const result = await toggleLike("user-1", "article-1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_allowed");
  });
});

describe("getLikeStatus", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns liked=true and count for authenticated user (AC2)", async () => {
    makeServiceClient({ existingLike: { article_id: "article-1", user_id: "user-1" } });
    const result = await getLikeStatus("user-1", "article-1");
    expect(result.liked).toBe(true);
    expect(typeof result.count).toBe("number");
  });

  it("returns liked=null and count for unauthenticated (AC2)", async () => {
    makeServiceClient({ existingLike: null });
    const result = await getLikeStatus(null, "article-1");
    expect(result.liked).toBeNull();
  });
});
