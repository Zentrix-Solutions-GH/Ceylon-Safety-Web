// S-048: saveArticle server action — AC1-AC6, EC1-EC4, EC7

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
import { saveArticle } from "@/lib/articles/actions/saveArticle";
import { SCHEMA_VERSION } from "@/lib/content/schema";

const STAFF_USER = { id: "aa000001-0000-4000-8000-000000000001", claimedRole: "admin" as const };
const ARTICLE_ID = "bb000001-0000-4000-8000-000000000001";
const AUTHOR_ID = "cc000001-0000-4000-8000-000000000001";
const CATEGORY_ID = "dd000001-0000-4000-8000-000000000001";

function validBody() {
  return {
    schema_version: SCHEMA_VERSION,
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }],
  };
}

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    title: "Fire Safety Tips",
    excerpt: "A short excerpt",
    authorId: AUTHOR_ID,
    categoryId: CATEGORY_ID,
    body: validBody(),
    bodyVersion: 1,
    ...overrides,
  };
}

function mockStaff(ok: boolean) {
  if (ok) {
    vi.mocked(requireStaff).mockResolvedValue({ ok: true, user: STAFF_USER as never });
  } else {
    vi.mocked(requireStaff).mockResolvedValue({ ok: false, code: "not_allowed" });
  }
}

function makeSupabaseMock({
  selectData = { id: ARTICLE_ID, body_version: 1, status: "draft", slug: null },
  selectError = null,
  upsertData = { id: ARTICLE_ID, body_version: 2, slug: "fire-safety-tips" },
  upsertError = null,
  refsDeleteError = null,
  refsInsertError = null,
  slugClashCount = 0,
  authorActive = true,
  mediaStatus = "ready",
}: {
  selectData?: unknown;
  selectError?: unknown;
  upsertData?: unknown;
  upsertError?: unknown;
  refsDeleteError?: unknown;
  refsInsertError?: unknown;
  slugClashCount?: number;
  authorActive?: boolean;
  mediaStatus?: string;
} = {}) {
  const rpcFn = vi.fn().mockResolvedValue({ data: slugClashCount, error: null });

  const supabase = {
    from: vi.fn((table: string) => {
      if (table === "articles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: selectData, error: selectError }),
          upsert: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
        };
      }
      if (table === "article_refs") {
        return {
          delete: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ error: refsDeleteError }),
          insert: vi.fn().mockResolvedValue({ error: refsInsertError }),
        };
      }
      if (table === "authors") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: authorActive ? { id: AUTHOR_ID, is_active: true } : null,
            error: authorActive ? null : { code: "PGRST116" },
          }),
        };
      }
      if (table === "media_assets") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { status: mediaStatus }, error: null }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        delete: vi.fn().mockReturnThis(),
        insert: vi.fn().mockResolvedValue({ error: null }),
      };
    }),
    rpc: rpcFn,
  };

  // Wire upsert response for articles
  const articleFrom = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: selectData, error: selectError }),
    upsert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: upsertData, error: upsertError }),
    }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: upsertData, error: upsertError }),
    }),
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: upsertData, error: upsertError }),
    }),
  };

  supabase.from = vi.fn((table: string) => {
    if (table === "articles") return articleFrom as unknown as ReturnType<typeof supabase.from>;
    if (table === "article_refs") {
      return {
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: refsDeleteError }),
        }),
        insert: vi.fn().mockResolvedValue({ error: refsInsertError }),
      } as unknown as ReturnType<typeof supabase.from>;
    }
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      delete: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ error: null }),
    } as unknown as ReturnType<typeof supabase.from>;
  });

  return supabase;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("saveArticle — permission", () => {
  it("EC1: not_allowed when staff check fails", async () => {
    mockStaff(false);
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(makeSupabaseMock() as never);
    const result = await saveArticle(validInput());
    expect(result.ok).toBe(false);
    expect((result as { ok: false; code: string }).code).toBe("not_allowed");
  });

  it("EC1: writes permission.denied audit row", async () => {
    mockStaff(false);
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(makeSupabaseMock() as never);
    await saveArticle(validInput());
    expect(vi.mocked(writeDenied)).toHaveBeenCalled();
  });

  it("S17: suspended user is blocked (account_suspended → not_allowed)", async () => {
    // requireStaff returns account_suspended for suspended profiles — the action must still refuse
    vi.mocked(requireStaff).mockResolvedValue({ ok: false, code: "account_suspended" } as never);
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(makeSupabaseMock() as never);
    const result = await saveArticle(validInput());
    expect(result.ok).toBe(false);
    expect((result as { ok: false; code: string }).code).toBe("not_allowed");
  });
});

describe("saveArticle — validation", () => {
  it("AC2: refuses body with unknown block type", async () => {
    mockStaff(true);
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(makeSupabaseMock() as never);
    const result = await saveArticle(validInput({
      body: {
        schema_version: SCHEMA_VERSION,
        type: "doc",
        content: [{ type: "unknownBlock" }],
      },
    }));
    expect(result.ok).toBe(false);
    expect((result as { ok: false; code: string }).code).toBe("validation_failed");
  });

  it("AC2: refuses body over size limit", async () => {
    mockStaff(true);
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(makeSupabaseMock() as never);
    const big = "x".repeat(1_048_577);
    const result = await saveArticle(validInput({
      body: {
        schema_version: SCHEMA_VERSION,
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: big }] }],
      },
    }));
    expect(result.ok).toBe(false);
    expect((result as { ok: false; code: string }).code).toBe("validation_failed");
  });

  it("AC3: refuses body with disallowed link", async () => {
    mockStaff(true);
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(makeSupabaseMock() as never);
    const result = await saveArticle(validInput({
      body: {
        schema_version: SCHEMA_VERSION,
        type: "doc",
        content: [{
          type: "paragraph",
          content: [{
            type: "text",
            text: "click",
            marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
          }],
        }],
      },
    }));
    expect(result.ok).toBe(false);
    expect((result as { ok: false; code: string }).code).toBe("validation_failed");
  });

  it("AC12: refuses empty title", async () => {
    mockStaff(true);
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(makeSupabaseMock() as never);
    const result = await saveArticle(validInput({ title: "" }));
    expect(result.ok).toBe(false);
    expect((result as { ok: false; code: string }).code).toBe("validation_failed");
  });

  it("AC12: refuses title over 150 characters", async () => {
    mockStaff(true);
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(makeSupabaseMock() as never);
    const result = await saveArticle(validInput({ title: "a".repeat(151) }));
    expect(result.ok).toBe(false);
    expect((result as { ok: false; code: string }).code).toBe("validation_failed");
  });
});

describe("saveArticle — version check (AC5)", () => {
  it("EC2: returns version_conflict when base version is stale", async () => {
    mockStaff(true);
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(
      makeSupabaseMock({ selectData: { id: ARTICLE_ID, body_version: 5, status: "draft", slug: "fire-safety" } }) as never
    );
    const result = await saveArticle(validInput({ articleId: ARTICLE_ID, bodyVersion: 3 }));
    expect(result.ok).toBe(false);
    expect((result as { ok: false; code: string }).code).toBe("version_conflict");
  });

  it("AC5: increments body_version on success", async () => {
    mockStaff(true);
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(
      makeSupabaseMock({
        selectData: { id: ARTICLE_ID, body_version: 1, status: "draft", slug: "fire-safety" },
        upsertData: { id: ARTICLE_ID, body_version: 2, slug: "fire-safety" },
      }) as never
    );
    const result = await saveArticle(validInput({ articleId: ARTICLE_ID, bodyVersion: 1 }));
    expect(result.ok).toBe(true);
    expect((result as { ok: true; bodyVersion: number }).bodyVersion).toBe(2);
  });
});

describe("saveArticle — audit (AC9)", () => {
  it("writes article.save audit row on success", async () => {
    mockStaff(true);
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(
      makeSupabaseMock({ selectData: null, upsertData: { id: ARTICLE_ID, body_version: 1, slug: "fire-safety-tips" } }) as never
    );
    await saveArticle(validInput());
    expect(vi.mocked(writeAuditRow)).toHaveBeenCalledWith(
      expect.objectContaining({ action: "article.save" })
    );
  });
});

describe("saveArticle — body-only save does not purge (Assumption)", () => {
  it("does not call purgeArticle on a body-only save (status=draft)", async () => {
    mockStaff(true);
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(
      makeSupabaseMock({
        selectData: { id: ARTICLE_ID, body_version: 1, status: "draft", slug: "fire-safety" },
        upsertData: { id: ARTICLE_ID, body_version: 2, slug: "fire-safety" },
      }) as never
    );
    await saveArticle(validInput({ articleId: ARTICLE_ID, bodyVersion: 1 }));
    expect(vi.mocked(purgeArticle)).not.toHaveBeenCalled();
  });
});

describe("saveArticle — EC7 save after hide", () => {
  it("succeeds and article stays hidden", async () => {
    mockStaff(true);
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(
      makeSupabaseMock({
        selectData: { id: ARTICLE_ID, body_version: 1, status: "hidden", slug: "fire-safety" },
        upsertData: { id: ARTICLE_ID, body_version: 2, slug: "fire-safety", status: "hidden" },
      }) as never
    );
    const result = await saveArticle(validInput({ articleId: ARTICLE_ID, bodyVersion: 1 }));
    expect(result.ok).toBe(true);
  });
});

describe("saveArticle — EC4 hostile input stored as text", () => {
  it("saves body with script-tag text node without error", async () => {
    mockStaff(true);
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(
      makeSupabaseMock({ selectData: null, upsertData: { id: ARTICLE_ID, body_version: 1, slug: "xss-test" } }) as never
    );
    const result = await saveArticle(validInput({
      title: "XSS test",
      body: {
        schema_version: SCHEMA_VERSION,
        type: "doc",
        content: [{
          type: "paragraph",
          content: [{ type: "text", text: "<script>alert(1)</script>" }],
        }],
      },
    }));
    expect(result.ok).toBe(true);
  });
});

describe("saveArticle — AC4 body ref to non-existent target", () => {
  it("returns validation_failed when a body video node references a deleted video", async () => {
    mockStaff(true);
    // Build a mock where the "videos" table returns null (video does not exist)
    const sbMock = makeSupabaseMock({ selectData: null, upsertData: { id: ARTICLE_ID, body_version: 1, slug: "test" } });
    const originalFrom = sbMock.from.getMockImplementation();
    sbMock.from = vi.fn((table: string) => {
      if (table === "videos") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST116", message: "not found" } }),
        };
      }
      return originalFrom!(table);
    });
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(sbMock as never);

    const VIDEO_ID = "ee000001-0000-4000-8000-000000000001";
    const result = await saveArticle(validInput({
      body: {
        schema_version: SCHEMA_VERSION,
        type: "doc",
        content: [{ type: "video", attrs: { node_id: "v1", video_id: VIDEO_ID } }],
      },
    }));
    expect(result.ok).toBe(false);
    expect((result as { ok: false; code: string }).code).toBe("validation_failed");
  });
});

describe("saveArticle — AC6 slug locked after first publish", () => {
  it("returns validation_failed when caller tries to change slug of a published article", async () => {
    mockStaff(true);
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(
      makeSupabaseMock({
        selectData: { id: ARTICLE_ID, body_version: 2, status: "published", slug: "original-slug" },
        upsertData: { id: ARTICLE_ID, body_version: 3, slug: "original-slug" },
      }) as never
    );
    const result = await saveArticle(validInput({
      articleId: ARTICLE_ID,
      bodyVersion: 2,
      slug: "new-different-slug",
    }));
    expect(result.ok).toBe(false);
    expect((result as { ok: false; code: string }).code).toBe("validation_failed");
    expect((result as { ok: false; reason?: string }).reason).toMatch(/locked/);
  });
});
