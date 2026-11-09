// S-053: AC11 — listAdminVideos

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

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/server";
import { listAdminVideos } from "@/lib/videos/actions/listAdminVideos";

const STAFF = { ok: true as const, user: { id: "staff-1", claimedRole: "admin" as const } };
const PAST = "2020-01-01T00:00:00Z";
const FUTURE = "2099-01-01T00:00:00Z";

function makeVideoRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "video-1",
    youtube_id: "dQw4w9WgXcQ",
    title: "Test Video",
    description: null,
    category_id: "cat-1",
    thumbnail_key: "thumbnails/test.jpg",
    thumbnail_source: "youtube_copy",
    locale: "en",
    status: "published",
    published_at: PAST,
    updated_at: "2026-01-01T00:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
    ...overrides,
  };
}

function makeSupabase(rows: unknown[], error: unknown = null) {
  const range = vi.fn().mockResolvedValue({ data: rows, error });
  const order = vi.fn().mockReturnValue({ range });
  const gt = vi.fn().mockReturnValue({ order, range });
  const eq: ReturnType<typeof vi.fn> = vi.fn().mockReturnValue({ order, range, gt });
  const is = vi.fn().mockReturnValue({ order, eq, range });
  const select = vi.fn().mockReturnValue({ eq, is, order, range });
  return { from: vi.fn().mockReturnValue({ select }) } as unknown as ReturnType<typeof createSupabaseServiceRoleClient>;
}

beforeEach(() => {
  vi.mocked(requireStaff).mockResolvedValue(STAFF as never);
  vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(makeSupabase([makeVideoRow()]));
});

describe("listAdminVideos — AC11", () => {
  it("requires videos.* permission", async () => {
    await listAdminVideos({});
    expect(requireStaff).toHaveBeenCalledWith("videos.*");
  });

  it("returns not_allowed for missing permission", async () => {
    vi.mocked(requireStaff).mockResolvedValue({ ok: false, code: "not_allowed" } as never);
    const result = await listAdminVideos({});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_allowed");
  });

  it("returns 25 items per page", async () => {
    const rows = Array.from({ length: 26 }, (_, i) => makeVideoRow({ id: `v-${i}` }));
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(makeSupabase(rows));
    const result = await listAdminVideos({});
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.videos.length).toBeLessThanOrEqual(25);
  });

  it("sets hasMore = true when 26 rows returned", async () => {
    const rows = Array.from({ length: 26 }, (_, i) => makeVideoRow({ id: `v-${i}` }));
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(makeSupabase(rows));
    const result = await listAdminVideos({});
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.hasMore).toBe(true);
  });

  it("computes status=scheduled when published and published_at > now()", async () => {
    const rows = [makeVideoRow({ status: "published", published_at: FUTURE })];
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(makeSupabase(rows));
    const result = await listAdminVideos({});
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.videos[0].computedStatus).toBe("scheduled");
  });

  it("computes status=published when published and published_at <= now()", async () => {
    const result = await listAdminVideos({});
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.videos[0].computedStatus).toBe("published");
  });

  it("computes status=draft for draft rows", async () => {
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(makeSupabase([makeVideoRow({ status: "draft", published_at: null })]));
    const result = await listAdminVideos({});
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.videos[0].computedStatus).toBe("draft");
  });

  it("returns ok:false code:unknown on DB error", async () => {
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(makeSupabase([], { message: "PGRST" }));
    const result = await listAdminVideos({});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("unknown");
  });
});
