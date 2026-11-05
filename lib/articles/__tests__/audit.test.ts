// S-048: audit rows — AC9

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
import { writeAuditRow } from "@/lib/audit/index";
import { saveArticle } from "@/lib/articles/actions/saveArticle";
import { setArticleStatus } from "@/lib/articles/actions/setArticleStatus";
import { SCHEMA_VERSION } from "@/lib/content/schema";

const STAFF_USER = { id: "aa000004-0000-4000-8000-000000000001", claimedRole: "admin" as const };
const ARTICLE_ID = "bb000004-0000-4000-8000-000000000001";

function mockStaff() {
  vi.mocked(requireStaff).mockResolvedValue({ ok: true, user: STAFF_USER as never });
}

function validBody() {
  return { schema_version: SCHEMA_VERSION, type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hi" }] }] };
}

function makeArticle(overrides: Record<string, unknown> = {}) {
  return {
    id: ARTICLE_ID,
    title: "Fire Safety",
    excerpt: "An excerpt",
    cover_image_key: "img/cover.webp",
    cover_image_alt: "A cover",
    author_id: "cc000004-0000-4000-8000-000000000001",
    category_id: "dd000004-0000-4000-8000-000000000001",
    status: "draft",
    published_at: null,
    body: validBody(),
    body_version: 1,
    slug: "fire-safety",
    ...overrides,
  };
}

function makeSupabase(article: Record<string, unknown>) {
  return {
    from: vi.fn((table: string) => {
      if (table === "articles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: article, error: null }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { ...article, body_version: 2 }, error: null }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: article, error: null }),
          }),
          upsert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { ...article, body_version: 2 }, error: null }),
          }),
        };
      }
      if (table === "article_refs") {
        const refsChain = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          delete: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
          insert: vi.fn().mockResolvedValue({ error: null }),
          then: vi.fn().mockImplementation((cb: (v: unknown) => unknown) =>
            Promise.resolve(cb({ data: [], error: null }))
          ),
        };
        refsChain.eq = vi.fn().mockReturnValue({
          ...refsChain,
          then: vi.fn().mockImplementation((cb: (v: unknown) => unknown) =>
            Promise.resolve(cb({ data: [], error: null }))
          ),
        });
        return refsChain;
      }
      if (table === "authors") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: article.author_id, is_active: true }, error: null }),
        };
      }
      if (table === "media_assets") {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error: null }) };
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Audit rows (AC9)", () => {
  it("saveArticle writes article.save", async () => {
    mockStaff();
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(makeSupabase(makeArticle({ body_version: 1, slug: null })) as never);
    await saveArticle({ title: "Fire Safety", authorId: "cc000004-0000-4000-8000-000000000001", categoryId: "dd000004-0000-4000-8000-000000000001", body: validBody(), bodyVersion: 1 });
    const calls = vi.mocked(writeAuditRow).mock.calls.map(([e]) => (e as { action: string }).action);
    expect(calls).toContain("article.save");
  });

  it("setArticleStatus publish writes article.publish", async () => {
    mockStaff();
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(makeSupabase(makeArticle({ status: "draft" })) as never);
    await setArticleStatus({ articleId: ARTICLE_ID, action: "publish", publishedAt: new Date().toISOString() });
    const calls = vi.mocked(writeAuditRow).mock.calls.map(([e]) => (e as { action: string }).action);
    expect(calls).toContain("article.publish");
  });

  it("setArticleStatus hide writes article.hide", async () => {
    mockStaff();
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(makeSupabase(makeArticle({ status: "published" })) as never);
    await setArticleStatus({ articleId: ARTICLE_ID, action: "hide" });
    const calls = vi.mocked(writeAuditRow).mock.calls.map(([e]) => (e as { action: string }).action);
    expect(calls).toContain("article.hide");
  });

  it("setArticleStatus delete writes article.delete", async () => {
    mockStaff();
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(makeSupabase(makeArticle({ status: "published" })) as never);
    await setArticleStatus({ articleId: ARTICLE_ID, action: "delete" });
    const calls = vi.mocked(writeAuditRow).mock.calls.map(([e]) => (e as { action: string }).action);
    expect(calls).toContain("article.delete");
  });

  it("saveArticle writes article.slug_change when slug changes on unpublished article (AC9)", async () => {
    mockStaff();
    // existing article has slug "fire-safety"; update uses slug "new-slug"
    const existingArticle = makeArticle({ body_version: 1, slug: "fire-safety", status: "draft" });
    const updatedArticle = { ...existingArticle, slug: "new-slug", body_version: 2 };
    const supabaseMock = {
      from: vi.fn((table: string) => {
        if (table === "articles") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: existingArticle, error: null }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: updatedArticle, error: null }),
            }),
          };
        }
        if (table === "article_refs") {
          return {
            delete: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error: null }) };
      }),
    };
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(supabaseMock as never);
    await saveArticle({
      articleId: ARTICLE_ID,
      title: "Fire Safety",
      slug: "new-slug",
      authorId: "cc000004-0000-4000-8000-000000000001",
      categoryId: "dd000004-0000-4000-8000-000000000001",
      body: validBody(),
      bodyVersion: 1,
    });
    const calls = vi.mocked(writeAuditRow).mock.calls.map(([e]) => (e as { action: string }).action);
    expect(calls).toContain("article.slug_change");
  });

  it("exactly one audit row per saveArticle call", async () => {
    mockStaff();
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(makeSupabase(makeArticle({ body_version: 1, slug: null })) as never);
    await saveArticle({ title: "Fire Safety", authorId: "cc000004-0000-4000-8000-000000000001", categoryId: "dd000004-0000-4000-8000-000000000001", body: validBody(), bodyVersion: 1 });
    const saveCalls = vi.mocked(writeAuditRow).mock.calls.filter(
      ([e]) => (e as { action: string }).action === "article.save"
    );
    expect(saveCalls).toHaveLength(1);
  });
});
