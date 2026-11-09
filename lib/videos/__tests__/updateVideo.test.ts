// S-053: AC6, EC8 — updateVideo

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
vi.mock("@/lib/media/validateMediaAsset", () => ({
  validateMediaAsset: vi.fn(),
}));

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/server";
import { writeAuditRow } from "@/lib/audit/index";
import { validateMediaAsset } from "@/lib/media/validateMediaAsset";
import { updateVideo } from "@/lib/videos/actions/updateVideo";

const STAFF = { ok: true as const, user: { id: "staff-1", claimedRole: "admin" as const } };
const VIDEO_ID = "00000000-0000-4000-8000-000000000030";
const MEDIA_ID = "00000000-0000-4000-8000-000000000050";
const UPDATED_AT = "2026-01-01T00:00:00Z";

const SAVED_ROW = {
  id: VIDEO_ID,
  youtube_id: "dQw4w9WgXcQ",
  title: "Updated Title",
  description: null,
  category_id: "00000000-0000-4000-8000-000000000020",
  thumbnail_key: "media/custom.jpg",
  thumbnail_source: "custom",
  locale: "en",
  status: "draft",
  published_at: null,
  updated_at: "2026-01-02T00:00:00Z",
  created_at: "2026-01-01T00:00:00Z",
};

function makeSupabase(overrides: { data?: unknown; error?: unknown } = {}) {
  const single = vi.fn().mockResolvedValue({ data: overrides.data ?? SAVED_ROW, error: overrides.error ?? null });
  const select = vi.fn().mockReturnValue({ single });
  const eq: ReturnType<typeof vi.fn> = vi.fn();
  eq.mockReturnValue({ select, single, eq });
  const update = vi.fn().mockReturnValue({ eq });
  return { from: vi.fn().mockReturnValue({ update }) } as unknown as ReturnType<typeof createSupabaseServiceRoleClient>;
}

beforeEach(() => {
  vi.mocked(requireStaff).mockResolvedValue(STAFF as never);
  vi.mocked(writeAuditRow).mockResolvedValue(undefined);
  vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(makeSupabase());
  vi.mocked(validateMediaAsset).mockResolvedValue({ ok: true, key: "media/custom.jpg" });
});

describe("updateVideo — AC6: custom thumbnail replaces copy", () => {
  it("sets thumbnail_source = custom when custom thumbnail provided", async () => {
    const result = await updateVideo({ id: VIDEO_ID, customThumbnailMediaId: MEDIA_ID, updatedAt: UPDATED_AT });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.video.thumbnailSource).toBe("custom");
  });

  it("validates media asset is confirmed and ready", async () => {
    await updateVideo({ id: VIDEO_ID, customThumbnailMediaId: MEDIA_ID, updatedAt: UPDATED_AT });
    expect(validateMediaAsset).toHaveBeenCalledWith(MEDIA_ID, expect.anything());
  });

  it("writes video.update audit row", async () => {
    await updateVideo({ id: VIDEO_ID, title: "New Title", updatedAt: UPDATED_AT });
    expect(writeAuditRow).toHaveBeenCalledWith(expect.objectContaining({ action: "video.update" }));
  });
});

describe("updateVideo — EC8: pending or non-existent media id", () => {
  it("returns validation_failed when media asset is pending", async () => {
    vi.mocked(validateMediaAsset).mockResolvedValue({ ok: false, code: "not_ready" });
    const result = await updateVideo({ id: VIDEO_ID, customThumbnailMediaId: MEDIA_ID, updatedAt: UPDATED_AT });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("validation_failed");
  });

  it("returns validation_failed when media asset does not exist", async () => {
    vi.mocked(validateMediaAsset).mockResolvedValue({ ok: false, code: "not_found" });
    const result = await updateVideo({ id: VIDEO_ID, customThumbnailMediaId: MEDIA_ID, updatedAt: UPDATED_AT });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("validation_failed");
  });
});

describe("updateVideo — version guard", () => {
  it("returns not_found or version_conflict when DB returns PGRST116", async () => {
    // Simulate: update returns no rows (PGRST116), existence check returns null (not_found)
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const eqExist = vi.fn().mockReturnValue({ maybeSingle });
    const selectExist = vi.fn().mockReturnValue({ eqExist, eq: eqExist });

    const singleUpdate = vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } });
    const selectUpdate = vi.fn().mockReturnValue({ single: singleUpdate });
    const eqUpdate: ReturnType<typeof vi.fn> = vi.fn();
    eqUpdate.mockReturnValue({ select: selectUpdate, single: singleUpdate, eq: eqUpdate });
    const update = vi.fn().mockReturnValue({ eq: eqUpdate });

    let callCount = 0;
    const from = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return { update };
      return { select: selectExist };
    });

    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue({ from } as never);
    const result = await updateVideo({ id: VIDEO_ID, title: "T", updatedAt: UPDATED_AT });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(["not_found", "version_conflict"]).toContain(result.code);
  });
});
