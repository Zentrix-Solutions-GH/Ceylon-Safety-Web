// S-049: getArticlePreview — AC6, EC8

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
  revalidateTag: vi.fn(),
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
}));

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/server";
import { getArticlePreview } from "@/lib/articles/getArticlePreview";
import { SCHEMA_VERSION } from "@/lib/content/schema";
import { unstable_noStore } from "next/cache";

const STAFF_USER = { id: "staff-1", claimedRole: "admin" as const };

function makeChain(row: unknown | null, assetStatus?: string, videoRows: unknown[] = []) {
  const articleChain: Record<string, unknown> = {};
  const methods = ["select", "eq", "maybeSingle"];
  for (const m of methods) {
    articleChain[m] = vi.fn().mockReturnThis();
  }
  articleChain.maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });

  const assetChain: Record<string, unknown> = {};
  for (const m of methods) {
    assetChain[m] = vi.fn().mockReturnThis();
  }
  assetChain.maybeSingle = vi
    .fn()
    .mockResolvedValue({ data: assetStatus ? { status: assetStatus } : null, error: null });

  const videoChain: Record<string, unknown> = { select: vi.fn().mockReturnThis() };
  videoChain.in = vi.fn().mockResolvedValue({ data: videoRows, error: null });

  const supabase = {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "media_assets") return assetChain;
      if (table === "videos") return videoChain;
      return articleChain;
    }),
  };
  (createSupabaseServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(supabase);
  return supabase;
}

const DRAFT_ROW = {
  id: "art-1",
  slug: "draft-article",
  title: "Draft",
  excerpt: null,
  cover_image_key: null,
  cover_image_alt: null,
  seo_title: null,
  seo_description: null,
  status: "draft",
  published_at: null,
  like_count: 0,
  comment_count: 0,
  body: { schema_version: SCHEMA_VERSION, type: "doc", content: [] },
  categories: { id: "cat-1", name: "Fire Safety", slug: "fire-safety" },
  authors: { name: "Jane" },
  article_refs: [],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getArticlePreview — AC6", () => {
  it("requires staff permission", async () => {
    (requireStaff as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false });
    const result = await getArticlePreview("art-1");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("not_allowed");
  });

  it("returns draft article for staff", async () => {
    (requireStaff as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, user: STAFF_USER });
    makeChain(DRAFT_ROW);
    const result = await getArticlePreview("art-1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.status).toBe("draft");
  });

  it("returns not_found for unknown id", async () => {
    (requireStaff as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, user: STAFF_USER });
    makeChain(null);
    const result = await getArticlePreview("unknown-id");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("not_found");
  });

  it("calls unstable_noStore (never cached)", async () => {
    (requireStaff as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, user: STAFF_USER });
    makeChain(DRAFT_ROW);
    await getArticlePreview("art-1");
    expect(unstable_noStore).toHaveBeenCalled();
  });
});

// ─── EC8b: preview returns soft-deleted article (no deleted_at filter) ───────

describe("getArticlePreview — soft-deleted article", () => {
  it("returns soft-deleted article for staff (no deleted_at filter)", async () => {
    (requireStaff as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, user: STAFF_USER });
    const deletedRow = {
      ...DRAFT_ROW,
      deleted_at: "2026-10-01T08:00:00Z",
      status: "published",
    };
    makeChain(deletedRow);
    const result = await getArticlePreview("art-1");
    // Staff can still preview soft-deleted articles
    expect(result.ok).toBe(true);
  });
});

// ─── EC8: preview returns pending image flag ──────────────────────────────────

describe("getArticlePreview — EC8", () => {
  it("returns cover image status as pending when media_assets row is pending", async () => {
    (requireStaff as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, user: STAFF_USER });
    const rowWithPendingCover = {
      ...DRAFT_ROW,
      cover_image_key: "imgs/pending.jpg",
    };
    makeChain(rowWithPendingCover, "pending");
    const result = await getArticlePreview("art-1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The preview data includes pending flag
    expect(result.data.coverImageStatus).toBe("pending");
  });
});
