// S-048: setArticleStatus — AC7, AC8, EC1, EC10

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
vi.mock("@/lib/audit/index", () => ({
  writeAuditRow: vi.fn(),
  writeDenied: vi.fn(),
}));
vi.mock("@/lib/cache/purge", () => ({
  purgeArticle: vi.fn().mockResolvedValue({ ok: true }),
}));

import { requireStaff } from "@/lib/auth/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { writeAuditRow, writeDenied } from "@/lib/audit/index";
import { purgeArticle } from "@/lib/cache/purge";
import { setArticleStatus } from "@/lib/articles/actions/setArticleStatus";

const STAFF_USER = { id: "aa000002-0000-4000-8000-000000000001", claimedRole: "admin" as const };
const ARTICLE_ID = "bb000002-0000-4000-8000-000000000001";

function mockStaff(ok: boolean) {
  if (ok) {
    vi.mocked(requireStaff).mockResolvedValue({ ok: true, user: STAFF_USER as never });
  } else {
    vi.mocked(requireStaff).mockResolvedValue({ ok: false, code: "not_allowed" });
  }
}

function makeArticle(overrides: Record<string, unknown> = {}) {
  return {
    id: ARTICLE_ID,
    title: "Fire Safety",
    excerpt: "An excerpt",
    cover_image_key: "img/cover.webp",
    cover_image_alt: "A cover",
    author_id: "cc000002-0000-4000-8000-000000000001",
    category_id: "dd000002-0000-4000-8000-000000000001",
    status: "draft",
    published_at: null,
    body: { schema_version: 1, type: "doc", content: [] },
    body_version: 1,
    ...overrides,
  };
}

function makeSupabaseMock(article: Record<string, unknown>, authorActive = true, hasPendingMedia = false) {
  const updateResult = { data: { ...article }, error: null };
  return {
    from: vi.fn((table: string) => {
      if (table === "articles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: article, error: null }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue(updateResult),
          }),
        };
      }
      if (table === "authors") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: authorActive ? { id: article.author_id, is_active: true } : null,
            error: authorActive ? null : { code: "PGRST116" },
          }),
        };
      }
      if (table === "media_assets") {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: hasPendingMedia ? [{ status: "pending" }] : [],
            error: null,
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("setArticleStatus — permission", () => {
  it("S17: suspended user is blocked (account_suspended → not_allowed)", async () => {
    vi.mocked(requireStaff).mockResolvedValue({ ok: false, code: "account_suspended" } as never);
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue({} as never);
    const result = await setArticleStatus({ articleId: ARTICLE_ID, action: "publish", publishedAt: new Date().toISOString() });
    expect(result.ok).toBe(false);
    expect((result as { ok: false; code: string }).code).toBe("not_allowed");
  });

  it("EC1: not_allowed when staff check fails", async () => {
    mockStaff(false);
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(makeSupabaseMock(makeArticle()) as never);
    const result = await setArticleStatus({ articleId: ARTICLE_ID, action: "publish", publishedAt: new Date().toISOString() });
    expect(result.ok).toBe(false);
    expect((result as { ok: false; code: string }).code).toBe("not_allowed");
  });

  it("EC1: writes permission.denied audit row", async () => {
    mockStaff(false);
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(makeSupabaseMock(makeArticle()) as never);
    await setArticleStatus({ articleId: ARTICLE_ID, action: "publish", publishedAt: new Date().toISOString() });
    expect(vi.mocked(writeDenied)).toHaveBeenCalled();
  });
});

describe("setArticleStatus — publish checklist (AC7)", () => {
  it("returns validation_failed with missing items when title is absent", async () => {
    mockStaff(true);
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(
      makeSupabaseMock(makeArticle({ title: "" })) as never
    );
    const result = await setArticleStatus({ articleId: ARTICLE_ID, action: "publish", publishedAt: new Date().toISOString() });
    expect(result.ok).toBe(false);
    expect((result as { ok: false; code: string }).code).toBe("validation_failed");
    expect((result as { ok: false; missing?: { field: string }[] }).missing?.map(m => m.field)).toContain("title");
  });

  it("returns validation_failed when cover image is absent", async () => {
    mockStaff(true);
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(
      makeSupabaseMock(makeArticle({ cover_image_key: null })) as never
    );
    const result = await setArticleStatus({ articleId: ARTICLE_ID, action: "publish", publishedAt: new Date().toISOString() });
    expect(result.ok).toBe(false);
    expect((result as { ok: false; missing?: { field: string }[] }).missing?.map(m => m.field)).toContain("cover_image");
  });

  it("returns validation_failed when author is deactivated", async () => {
    mockStaff(true);
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(
      makeSupabaseMock(makeArticle(), false) as never
    );
    const result = await setArticleStatus({ articleId: ARTICLE_ID, action: "publish", publishedAt: new Date().toISOString() });
    expect(result.ok).toBe(false);
    expect((result as { ok: false; missing?: { field: string }[] }).missing?.map(m => m.field)).toContain("active_author");
  });

  it("returns validation_failed when cover image is pending", async () => {
    mockStaff(true);
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(
      makeSupabaseMock(makeArticle(), true, true) as never
    );
    const result = await setArticleStatus({ articleId: ARTICLE_ID, action: "publish", publishedAt: new Date().toISOString() });
    expect(result.ok).toBe(false);
    expect((result as { ok: false; missing?: { field: string }[] }).missing?.map(m => m.field)).toContain("images_ready");
  });

  it("returns validation_failed when publishedAt is absent for publish", async () => {
    mockStaff(true);
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(
      makeSupabaseMock(makeArticle()) as never
    );
    const result = await setArticleStatus({ articleId: ARTICLE_ID, action: "publish" });
    expect(result.ok).toBe(false);
    expect((result as { ok: false; missing?: { field: string }[] }).missing?.map(m => m.field)).toContain("published_at");
  });
});

describe("setArticleStatus — publish success (AC8)", () => {
  it("publishes immediately with a past time", async () => {
    mockStaff(true);
    const pastTime = new Date(Date.now() - 60_000).toISOString();
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(
      makeSupabaseMock(makeArticle({ published_at: pastTime })) as never
    );
    const result = await setArticleStatus({ articleId: ARTICLE_ID, action: "publish", publishedAt: pastTime });
    expect(result.ok).toBe(true);
  });

  it("EC10: accepts a publish time less than a minute away", async () => {
    mockStaff(true);
    const nearFuture = new Date(Date.now() + 30_000).toISOString();
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(
      makeSupabaseMock(makeArticle()) as never
    );
    const result = await setArticleStatus({ articleId: ARTICLE_ID, action: "publish", publishedAt: nearFuture });
    expect(result.ok).toBe(true);
  });

  it("stores status=published with future publishedAt for a future time", async () => {
    mockStaff(true);
    const futureTime = new Date(Date.now() + 3_600_000).toISOString();
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(
      makeSupabaseMock(makeArticle()) as never
    );
    const result = await setArticleStatus({ articleId: ARTICLE_ID, action: "publish", publishedAt: futureTime });
    expect(result.ok).toBe(true);
  });
});

describe("setArticleStatus — hide and delete", () => {
  it("hides an article", async () => {
    mockStaff(true);
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(
      makeSupabaseMock(makeArticle({ status: "published" })) as never
    );
    const result = await setArticleStatus({ articleId: ARTICLE_ID, action: "hide" });
    expect(result.ok).toBe(true);
    expect(vi.mocked(writeAuditRow)).toHaveBeenCalledWith(
      expect.objectContaining({ action: "article.hide" })
    );
  });

  it("deletes an article", async () => {
    mockStaff(true);
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(
      makeSupabaseMock(makeArticle({ status: "published" })) as never
    );
    const result = await setArticleStatus({ articleId: ARTICLE_ID, action: "delete" });
    expect(result.ok).toBe(true);
    expect(vi.mocked(writeAuditRow)).toHaveBeenCalledWith(
      expect.objectContaining({ action: "article.delete" })
    );
  });

  it("calls purgeArticle on status change", async () => {
    mockStaff(true);
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(
      makeSupabaseMock(makeArticle({ status: "published" })) as never
    );
    await setArticleStatus({ articleId: ARTICLE_ID, action: "hide" });
    expect(vi.mocked(purgeArticle)).toHaveBeenCalled();
  });
});
