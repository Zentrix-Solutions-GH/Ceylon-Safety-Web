// S-053: AC7, EC9 — setVideoStatus

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({
  serverConfig: { supabaseServiceRoleKey: "srk", videoPlaceholderKey: "placeholders/video.jpg" },
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
}));
vi.mock("@/lib/cache/purge", () => ({
  purgeVideo: vi.fn(),
}));

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/server";
import { writeAuditRow } from "@/lib/audit/index";
import { purgeVideo } from "@/lib/cache/purge";
import { setVideoStatus } from "@/lib/videos/actions/setVideoStatus";

const STAFF = { ok: true as const, user: { id: "staff-1", claimedRole: "admin" as const } };
const VIDEO_ID = "00000000-0000-4000-8000-000000000030";
const UPDATED_AT = "2026-01-01T00:00:00Z";
const CAT_ID = "00000000-0000-4000-8000-000000000020";

function makeRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: VIDEO_ID,
    youtube_id: "dQw4w9WgXcQ",
    title: "Test Video",
    description: null,
    category_id: CAT_ID,
    thumbnail_key: "thumbnails/test.jpg",
    thumbnail_source: "youtube_copy",
    locale: "en",
    status: "draft",
    published_at: null,
    updated_at: "2026-01-02T00:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeSupabase(row: Record<string, unknown> | null = makeRow(), dbError: unknown = null) {
  const single = vi.fn().mockResolvedValue({ data: row, error: dbError });
  const select = vi.fn().mockReturnValue({ single });
  // is() is called after the second eq() for non-delete actions (deleted_at IS NULL guard)
  const is: ReturnType<typeof vi.fn> = vi.fn().mockReturnValue({ select, single });
  const eq: ReturnType<typeof vi.fn> = vi.fn();
  eq.mockReturnValue({ select, single, eq, is });
  const update = vi.fn().mockReturnValue({ eq });
  return { from: vi.fn().mockReturnValue({ update }) } as unknown as ReturnType<typeof createSupabaseServiceRoleClient>;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireStaff).mockResolvedValue(STAFF as never);
  vi.mocked(writeAuditRow).mockResolvedValue(undefined);
  vi.mocked(purgeVideo).mockResolvedValue({ ok: true });
  vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(makeSupabase());
});

describe("setVideoStatus — AC7: audit events", () => {
  it("writes video.publish on publish action", async () => {
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(
      makeSupabase(makeRow({ status: "published", published_at: "2026-01-01T00:00:00Z" }))
    );
    await setVideoStatus({ id: VIDEO_ID, action: "publish", publishedAt: "2026-01-01T00:00:00Z", updatedAt: UPDATED_AT });
    expect(writeAuditRow).toHaveBeenCalledWith(expect.objectContaining({ action: "video.publish" }));
  });

  it("writes video.hide on hide action", async () => {
    await setVideoStatus({ id: VIDEO_ID, action: "hide", updatedAt: UPDATED_AT });
    expect(writeAuditRow).toHaveBeenCalledWith(expect.objectContaining({ action: "video.hide" }));
  });

  it("writes video.unhide on unhide action", async () => {
    await setVideoStatus({ id: VIDEO_ID, action: "unhide", updatedAt: UPDATED_AT });
    expect(writeAuditRow).toHaveBeenCalledWith(expect.objectContaining({ action: "video.unhide" }));
  });

  it("writes video.delete on delete action", async () => {
    await setVideoStatus({ id: VIDEO_ID, action: "delete", updatedAt: UPDATED_AT });
    expect(writeAuditRow).toHaveBeenCalledWith(expect.objectContaining({ action: "video.delete" }));
  });
});

describe("setVideoStatus — AC7: publish validation", () => {
  it("returns validation_failed when published_at missing on publish", async () => {
    const result = await setVideoStatus({ id: VIDEO_ID, action: "publish", updatedAt: UPDATED_AT });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("validation_failed");
  });
});

describe("setVideoStatus — AC8: purge on hide and delete", () => {
  it("calls purgeVideo on hide", async () => {
    await setVideoStatus({ id: VIDEO_ID, action: "hide", updatedAt: UPDATED_AT });
    expect(purgeVideo).toHaveBeenCalledWith(VIDEO_ID, expect.anything());
  });

  it("calls purgeVideo on delete", async () => {
    await setVideoStatus({ id: VIDEO_ID, action: "delete", updatedAt: UPDATED_AT });
    expect(purgeVideo).toHaveBeenCalledWith(VIDEO_ID, expect.anything());
  });

  it("does NOT call purgeVideo on publish (60s cache window handles it)", async () => {
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(
      makeSupabase(makeRow({ status: "published", published_at: "2026-01-01T00:00:00Z" }))
    );
    await setVideoStatus({ id: VIDEO_ID, action: "publish", publishedAt: "2026-01-01T00:00:00Z", updatedAt: UPDATED_AT });
    expect(purgeVideo).not.toHaveBeenCalled();
  });

  it("returns purge_failed when purge fails but change stays saved", async () => {
    vi.mocked(purgeVideo).mockResolvedValue({ ok: false, code: "purge_failed" });
    const result = await setVideoStatus({ id: VIDEO_ID, action: "hide", updatedAt: UPDATED_AT });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("purge_failed");
  });
});

describe("setVideoStatus — EC9: placeholder thumbnail at publish", () => {
  it("allows publish when thumbnail is the placeholder (placeholder counts as valid)", async () => {
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(
      makeSupabase(makeRow({ status: "published", published_at: "2026-01-01T00:00:00Z", thumbnail_key: "placeholders/video.jpg", title: "T", category_id: CAT_ID }))
    );
    const result = await setVideoStatus({ id: VIDEO_ID, action: "publish", publishedAt: "2026-01-01T00:00:00Z", updatedAt: UPDATED_AT });
    expect(result.ok).toBe(true);
  });
});
