// S-049: getArticleForEdit — AC7

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({
  serverConfig: { supabaseServiceRoleKey: "srk" },
  publicConfig: { supabaseUrl: "https://test.supabase.co", supabaseAnonKey: "anon" },
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: vi.fn(),
}));
vi.mock("@/lib/auth/server", () => ({
  requireStaff: vi.fn(),
}));
vi.mock("next/cache", () => ({
  unstable_noStore: vi.fn(),
}));

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/server";
import { getArticleForEdit } from "@/lib/articles/getArticleForEdit";
import { SCHEMA_VERSION } from "@/lib/content/schema";

const STAFF_USER = { id: "staff-1", claimedRole: "admin" as const };

function makeChain(row: unknown | null, assetStatus?: string) {
  const articleChain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "maybeSingle"]) {
    articleChain[m] = vi.fn().mockReturnThis();
  }
  articleChain.maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });

  const assetChain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "maybeSingle"]) {
    assetChain[m] = vi.fn().mockReturnThis();
  }
  assetChain.maybeSingle = vi
    .fn()
    .mockResolvedValue({ data: assetStatus ? { status: assetStatus } : null, error: null });

  const supabase = {
    from: vi.fn().mockImplementation((table: string) => {
      return table === "media_assets" ? assetChain : articleChain;
    }),
  };
  (createSupabaseServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(supabase);
  return supabase;
}

const BASE_ROW = {
  id: "art-1",
  title: "Draft Article",
  excerpt: null,
  slug: "draft-article",
  cover_image_key: null,
  cover_image_alt: null,
  cover_image_status: null,
  author_id: "author-1",
  category_id: "cat-1",
  published_at: null,
  status: "draft",
  body: { schema_version: SCHEMA_VERSION, type: "doc", content: [] },
  body_version: 3,
  seo_title: null,
  seo_description: null,
  article_refs: [],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getArticleForEdit — AC7", () => {
  it("requires staff permission", async () => {
    (requireStaff as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false });
    const result = await getArticleForEdit("art-1");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("not_allowed");
  });

  it("returns editor fields including body and body_version", async () => {
    (requireStaff as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, user: STAFF_USER });
    makeChain(BASE_ROW);
    const result = await getArticleForEdit("art-1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.bodyVersion).toBe(3);
    expect(result.data.body.type).toBe("doc");
  });

  it("returns not_found for unknown id", async () => {
    (requireStaff as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, user: STAFF_USER });
    makeChain(null);
    const result = await getArticleForEdit("unknown");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("not_found");
  });

  it("returns cover image status", async () => {
    (requireStaff as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, user: STAFF_USER });
    makeChain({ ...BASE_ROW, cover_image_key: "k.jpg" }, "ready");
    const result = await getArticleForEdit("art-1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.coverImageStatus).toBe("ready");
  });

  it("includes target status for video refs (published/hidden/deleted)", async () => {
    (requireStaff as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, user: STAFF_USER });
    makeChain({
      ...BASE_ROW,
      article_refs: [
        { ref_type: "video", ref_id: "vid-1", node_id: "n1", phrase: null, videos: { status: "published" } },
        { ref_type: "video", ref_id: "vid-2", node_id: "n2", phrase: null, videos: { status: "hidden" } },
      ],
    });
    const result = await getArticleForEdit("art-1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const statuses = result.data.resolvedVideos.map((v) => v.status);
    expect(statuses).toContain("published");
    expect(statuses).toContain("hidden");
  });
});
