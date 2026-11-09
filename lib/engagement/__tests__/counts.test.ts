// S-050: like/comment count integration — AC9

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({
  serverConfig: { supabaseServiceRoleKey: "srk" },
  publicConfig: { supabaseUrl: "https://test.supabase.co", supabaseAnonKey: "anon" },
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: vi.fn(),
}));

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getLikeStatus } from "@/lib/engagement/toggleLike";

function makeClient(likeCount: number, liked: boolean) {
  const chain = {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "articles") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { like_count: likeCount, status: "published", published_at: "2026-01-01T00:00:00Z", deleted_at: null },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "article_likes") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: liked ? { article_id: "art-1", user_id: "user-1" } : null,
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return {};
    }),
  };
  (createSupabaseServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(chain);
}

describe("getLikeStatus count (AC9)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the like_count from the articles row verbatim (AC9)", async () => {
    makeClient(42, false);
    const result = await getLikeStatus("user-1", "art-1");
    expect(result.count).toBe(42);
  });

  it("returns liked=true when the user has an existing like row", async () => {
    makeClient(5, true);
    const result = await getLikeStatus("user-1", "art-1");
    expect(result.liked).toBe(true);
    expect(result.count).toBe(5);
  });

  it("returns liked=false when no like row exists for the user", async () => {
    makeClient(3, false);
    const result = await getLikeStatus("user-1", "art-1");
    expect(result.liked).toBe(false);
  });

  it("returns liked=null and count=0 for hidden article (AC2 / P1 fix)", async () => {
    const chain = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { like_count: 10, status: "draft", published_at: null, deleted_at: null },
              error: null,
            }),
          }),
        }),
      }),
    };
    (createSupabaseServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(chain);
    const result = await getLikeStatus("user-1", "art-hidden");
    expect(result.liked).toBeNull();
    expect(result.count).toBe(0);
  });
});
