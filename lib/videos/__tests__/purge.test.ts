// S-053: AC8, EC5 — purgeVideo reaches home-first-page, feed-api, counters, and articles via article_refs

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
}));
vi.mock("@/lib/config", () => ({
  serverConfig: { supabaseServiceRoleKey: "srk" },
  publicConfig: { supabaseUrl: "https://test.supabase.co", supabaseAnonKey: "anon" },
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: vi.fn(),
}));
vi.mock("@/lib/audit/index", () => ({
  writeAuditRow: vi.fn(),
}));

import { revalidateTag } from "next/cache";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { purgeVideo } from "@/lib/cache/purge";

const VIDEO_ID = "00000000-0000-4000-8000-000000000030";
const ARTICLE_ID = "00000000-0000-4000-8000-000000000040";

function makeSupabase(articleIds: string[]) {
  const rows = articleIds.map(id => ({ article_id: id }));
  const eq2 = vi.fn().mockResolvedValue({ data: rows, error: null });
  const eq = vi.fn().mockReturnValue({ eq: eq2 });
  const select = vi.fn().mockReturnValue({ eq });
  return { from: vi.fn().mockReturnValue({ select }) } as unknown as ReturnType<typeof createSupabaseServiceRoleClient>;
}

beforeEach(() => {
  vi.mocked(revalidateTag).mockImplementation(() => {});
  vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(makeSupabase([ARTICLE_ID]));
});

describe("purgeVideo — AC8", () => {
  it("clears home-first-page tag", async () => {
    await purgeVideo(VIDEO_ID);
    expect(revalidateTag).toHaveBeenCalledWith("home-first-page");
  });

  it("clears feed-api tag", async () => {
    await purgeVideo(VIDEO_ID);
    expect(revalidateTag).toHaveBeenCalledWith("feed-api");
  });

  it("clears counters tag", async () => {
    await purgeVideo(VIDEO_ID);
    expect(revalidateTag).toHaveBeenCalledWith("counters");
  });

  it("clears article tag for each article that uses the video via article_refs — EC5", async () => {
    await purgeVideo(VIDEO_ID, "staff-1");
    expect(revalidateTag).toHaveBeenCalledWith(`article:${ARTICLE_ID}`);
  });

  it("returns ok:true when all tags succeed", async () => {
    const result = await purgeVideo(VIDEO_ID);
    expect(result.ok).toBe(true);
  });

  it("returns purge_failed when revalidateTag throws", async () => {
    vi.mocked(revalidateTag).mockImplementation(() => { throw new Error("network"); });
    const result = await purgeVideo(VIDEO_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("purge_failed");
  });
});
