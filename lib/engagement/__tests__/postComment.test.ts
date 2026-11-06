// S-050: postComment — AC4, AC5, AC6, EC4, EC6, EC8

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
import { postComment } from "@/lib/engagement/postComment";

function makeClient(opts: {
  articleData?: Record<string, unknown> | null;
  articleError?: { message: string } | null;
  insertError?: { code?: string; message: string } | null;
  insertData?: Record<string, unknown> | null;
} = {}) {
  const articleData = opts.articleData !== undefined
    ? opts.articleData
    : { id: "art-1", status: "published", published_at: "2026-01-01T00:00:00Z", deleted_at: null };

  // Service role — articles read only
  const serviceChain = {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "articles") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: articleData,
                error: opts.articleError ?? null,
              }),
            }),
          }),
        };
      }
      return {};
    }),
  };

  // Server (user-scoped) client — article_comments insert
  const serverChain = {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "article_comments") {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: opts.insertData ?? { id: "cmt-1" },
                error: opts.insertError ?? null,
              }),
            }),
          }),
        };
      }
      return {};
    }),
  };

  (createSupabaseServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(serviceChain);
  (createSupabaseServerClient as ReturnType<typeof vi.fn>).mockResolvedValue(serverChain);
  return { serviceChain, serverChain };
}

describe("postComment", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a pending comment and returns the id (AC4)", async () => {
    makeClient({ insertData: { id: "cmt-new" } });
    const result = await postComment("user-1", "art-1", "Hello world");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.id).toBe("cmt-new");
  });

  it("strips control characters from text before saving (EC4)", async () => {
    let capturedBody: string | undefined;
    const serviceChain = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "articles") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: "art-1", status: "published", published_at: "2026-01-01T00:00:00Z", deleted_at: null },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      }),
    };
    const serverChain = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "article_comments") {
          return {
            insert: vi.fn().mockImplementation((rows: Array<Record<string, string>>) => {
              capturedBody = rows[0]?.body;
              return {
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: { id: "cmt-1" }, error: null }),
                }),
              };
            }),
          };
        }
        return {};
      }),
    };
    (createSupabaseServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(serviceChain);
    (createSupabaseServerClient as ReturnType<typeof vi.fn>).mockResolvedValue(serverChain);
    await postComment("user-1", "art-1", "Hello\u0000World‮Test");
    // Control char U+0000 and direction override U+202E must be stripped
    expect(capturedBody).not.toContain("\u0000");
    expect(capturedBody).not.toContain("‮");
    expect(capturedBody).toContain("HelloWorldTest");
  });

  it("returns validation_failed for empty text (EC8)", async () => {
    makeClient();
    const result = await postComment("user-1", "art-1", "");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("validation_failed");
  });

  it("returns validation_failed for whitespace-only text (EC8)", async () => {
    makeClient();
    const result = await postComment("user-1", "art-1", "   ");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("validation_failed");
  });

  it("returns validation_failed for text over 2000 chars (EC8)", async () => {
    makeClient();
    const result = await postComment("user-1", "art-1", "a".repeat(2001));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("validation_failed");
  });

  it("returns not_allowed for hidden article (AC6, EC6)", async () => {
    makeClient({ articleData: { id: "art-1", status: "draft", published_at: null, deleted_at: null } });
    const result = await postComment("user-1", "art-1", "Hello world");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_allowed");
  });

  it("returns not_allowed for deleted article (AC6)", async () => {
    makeClient({ articleData: { id: "art-1", status: "published", published_at: "2026-01-01", deleted_at: "2026-10-01" } });
    const result = await postComment("user-1", "art-1", "Hello world");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_allowed");
  });

  it("returns not_allowed for future-dated article (AC6)", async () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    makeClient({ articleData: { id: "art-1", status: "published", published_at: future, deleted_at: null } });
    const result = await postComment("user-1", "art-1", "Hello world");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_allowed");
  });

  it("maps DB hourly rate limit to rate_limited with reason=hourly (AC5)", async () => {
    makeClient({ insertError: { code: "23000", message: "ceylonsafety: rate_limited reason=hourly" } });
    const result = await postComment("user-1", "art-1", "Hello world");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("rate_limited");
      expect((result as { reason?: string }).reason).toBe("hourly");
    }
  });

  it("maps DB pending cap to rate_limited with reason=pending_cap (AC5)", async () => {
    makeClient({ insertError: { code: "23000", message: "ceylonsafety: rate_limited reason=pending_cap" } });
    const result = await postComment("user-1", "art-1", "Hello world");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("rate_limited");
      expect((result as { reason?: string }).reason).toBe("pending_cap");
    }
  });

  it("stores comment as pending status always (AC4)", async () => {
    let capturedStatus: string | undefined;
    const serviceChain = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "articles") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: "art-1", status: "published", published_at: "2026-01-01T00:00:00Z", deleted_at: null },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      }),
    };
    const serverChain = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "article_comments") {
          return {
            insert: vi.fn().mockImplementation((rows: Array<Record<string, string>>) => {
              capturedStatus = rows[0]?.status;
              return {
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: { id: "cmt-1" }, error: null }),
                }),
              };
            }),
          };
        }
        return {};
      }),
    };
    (createSupabaseServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(serviceChain);
    (createSupabaseServerClient as ReturnType<typeof vi.fn>).mockResolvedValue(serverChain);
    await postComment("user-1", "art-1", "Hello world");
    expect(capturedStatus).toBe("pending");
  });
});
