// S-053: AC2, AC3 — addVideo

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
vi.mock("@/lib/videos/thumbnailCopy", () => ({
  copyYouTubeThumbnail: vi.fn(),
}));
vi.mock("@/lib/media/validateMediaAsset", () => ({
  validateMediaAsset: vi.fn(),
}));

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/server";
import { writeAuditRow } from "@/lib/audit/index";
import { copyYouTubeThumbnail } from "@/lib/videos/thumbnailCopy";
import { validateMediaAsset } from "@/lib/media/validateMediaAsset";
import { addVideo } from "@/lib/videos/actions/addVideo";

const STAFF = { ok: true as const, user: { id: "staff-1", claimedRole: "admin" as const } };
const CAT_ID = "00000000-0000-4000-8000-000000000020";
const VIDEO_ID = "00000000-0000-4000-8000-000000000030";

const SAVED_ROW = {
  id: VIDEO_ID,
  youtube_id: "dQw4w9WgXcQ",
  title: "Test Video",
  description: null,
  category_id: CAT_ID,
  thumbnail_key: "thumbnails/dQw4w9WgXcQ.jpg",
  thumbnail_source: "youtube_copy",
  locale: "en",
  status: "draft",
  published_at: null,
  updated_at: "2026-01-01T00:00:00Z",
  created_at: "2026-01-01T00:00:00Z",
};

function makeSupabase(overrides: { insertData?: unknown; insertError?: unknown } = {}) {
  const single = vi.fn().mockResolvedValue({
    data: overrides.insertData ?? SAVED_ROW,
    error: overrides.insertError ?? null,
  });
  const select = vi.fn().mockReturnValue({ single });
  const insert = vi.fn().mockReturnValue({ select });
  const from = vi.fn().mockReturnValue({ insert });
  return { from } as unknown as ReturnType<typeof createSupabaseServiceRoleClient>;
}

beforeEach(() => {
  vi.mocked(requireStaff).mockResolvedValue(STAFF as never);
  vi.mocked(copyYouTubeThumbnail).mockResolvedValue({
    ok: true,
    thumbnailKey: "thumbnails/dQw4w9WgXcQ.jpg",
    thumbnailSource: "youtube_copy",
  });
  vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(makeSupabase());
  vi.mocked(writeAuditRow).mockResolvedValue(undefined);
});

describe("addVideo — AC2: permission check", () => {
  it("returns not_allowed when staff check fails", async () => {
    vi.mocked(requireStaff).mockResolvedValue({ ok: false, code: "not_allowed" } as never);
    const result = await addVideo({
      youtubeLink: "https://youtu.be/dQw4w9WgXcQ",
      title: "Test",
      categoryId: CAT_ID,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_allowed");
  });

  it("requires videos.* permission", async () => {
    await addVideo({ youtubeLink: "https://youtu.be/dQw4w9WgXcQ", title: "T", categoryId: CAT_ID });
    expect(requireStaff).toHaveBeenCalledWith("videos.*");
  });

  it("writes permission.denied audit row on not_allowed", async () => {
    vi.mocked(requireStaff).mockResolvedValue({ ok: false, code: "not_allowed" } as never);
    await addVideo({ youtubeLink: "https://youtu.be/dQw4w9WgXcQ", title: "T", categoryId: CAT_ID });
    expect(writeAuditRow).toHaveBeenCalledWith(expect.objectContaining({ action: "permission.denied" }));
  });
});

describe("addVideo — AC2: validation", () => {
  it("returns validation_failed for invalid youtube link", async () => {
    const result = await addVideo({ youtubeLink: "https://vimeo.com/abc", title: "T", categoryId: CAT_ID });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("validation_failed");
  });

  it("returns validation_failed for empty title", async () => {
    const result = await addVideo({ youtubeLink: "https://youtu.be/dQw4w9WgXcQ", title: "", categoryId: CAT_ID });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("validation_failed");
  });

  it("returns validation_failed for missing categoryId", async () => {
    const result = await addVideo({ youtubeLink: "https://youtu.be/dQw4w9WgXcQ", title: "T", categoryId: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("validation_failed");
  });

  it("stores YouTube id only (not full link)", async () => {
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(makeSupabase());
    await addVideo({ youtubeLink: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLxxx", title: "T", categoryId: CAT_ID });
    const supabase = vi.mocked(createSupabaseServiceRoleClient).mock.results[0].value;
    const insertCall = vi.mocked(supabase.from).mock.results[0]?.value?.insert?.mock?.calls?.[0]?.[0];
    if (insertCall) {
      expect(insertCall.youtube_id).toBe("dQw4w9WgXcQ");
      expect(insertCall.youtube_id).not.toContain("http");
    }
  });

  it("always creates row as draft", async () => {
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(makeSupabase());
    await addVideo({ youtubeLink: "https://youtu.be/dQw4w9WgXcQ", title: "T", categoryId: CAT_ID });
    const supabase = vi.mocked(createSupabaseServiceRoleClient).mock.results[0].value;
    const insertCall = vi.mocked(supabase.from).mock.results[0]?.value?.insert?.mock?.calls?.[0]?.[0];
    if (insertCall) expect(insertCall.status).toBe("draft");
  });

  it("writes locale = 'en'", async () => {
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(makeSupabase());
    await addVideo({ youtubeLink: "https://youtu.be/dQw4w9WgXcQ", title: "T", categoryId: CAT_ID });
    const supabase = vi.mocked(createSupabaseServiceRoleClient).mock.results[0].value;
    const insertCall = vi.mocked(supabase.from).mock.results[0]?.value?.insert?.mock?.calls?.[0]?.[0];
    if (insertCall) expect(insertCall.locale).toBe("en");
  });
});

describe("addVideo — AC3: duplicate YouTube id", () => {
  it("returns validation_failed when DB unique constraint fires (EC10)", async () => {
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(
      makeSupabase({ insertData: null, insertError: { code: "23505", message: "unique" } })
    );
    const result = await addVideo({ youtubeLink: "https://youtu.be/dQw4w9WgXcQ", title: "T", categoryId: CAT_ID });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("validation_failed");
      expect(result.field).toBe("youtubeLink");
    }
  });

  it("succeeds when re-adding a soft-deleted video's YouTube id (AC3)", async () => {
    // The DB partial unique index (WHERE deleted_at IS NULL) allows re-insert after soft delete.
    // addVideo does a plain INSERT; no unique violation fires for a deleted row's youtube_id.
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(makeSupabase());
    const result = await addVideo({ youtubeLink: "https://youtu.be/dQw4w9WgXcQ", title: "Re-add", categoryId: CAT_ID });
    expect(result.ok).toBe(true);
  });

  it("writes video.add audit row on success", async () => {
    await addVideo({ youtubeLink: "https://youtu.be/dQw4w9WgXcQ", title: "T", categoryId: CAT_ID });
    expect(writeAuditRow).toHaveBeenCalledWith(expect.objectContaining({ action: "video.add" }));
  });
});

describe("addVideo — AC6: custom thumbnail path", () => {
  const MEDIA_ID = "00000000-0000-4000-8000-000000000099";
  const CUSTOM_KEY = "media/custom-thumb.jpg";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireStaff).mockResolvedValue(STAFF as never);
    vi.mocked(writeAuditRow).mockResolvedValue(undefined);
    vi.mocked(validateMediaAsset).mockResolvedValue({ ok: true, key: CUSTOM_KEY });
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(
      makeSupabase({
        insertData: { ...SAVED_ROW, thumbnail_key: CUSTOM_KEY, thumbnail_source: "custom" },
      })
    );
  });

  it("skips thumbnail copy when customThumbnailMediaId is provided", async () => {
    await addVideo({
      youtubeLink: "https://youtu.be/dQw4w9WgXcQ",
      title: "T",
      categoryId: CAT_ID,
      customThumbnailMediaId: MEDIA_ID,
    });
    expect(copyYouTubeThumbnail).not.toHaveBeenCalled();
  });

  it("inserts thumbnail_source='custom' and thumbnail_key from media asset", async () => {
    await addVideo({
      youtubeLink: "https://youtu.be/dQw4w9WgXcQ",
      title: "T",
      categoryId: CAT_ID,
      customThumbnailMediaId: MEDIA_ID,
    });
    const supabase = vi.mocked(createSupabaseServiceRoleClient).mock.results.at(-1)!.value;
    const insertCall = vi.mocked(supabase.from).mock.results[0]?.value?.insert?.mock?.calls?.[0]?.[0];
    expect(insertCall?.thumbnail_source).toBe("custom");
    expect(insertCall?.thumbnail_key).toBe(CUSTOM_KEY);
  });

  it("returns validation_failed when media asset is not ready (EC8 for addVideo)", async () => {
    vi.mocked(validateMediaAsset).mockResolvedValue({ ok: false, code: "not_ready" });
    const result = await addVideo({
      youtubeLink: "https://youtu.be/dQw4w9WgXcQ",
      title: "T",
      categoryId: CAT_ID,
      customThumbnailMediaId: MEDIA_ID,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("validation_failed");
      expect(result.field).toBe("customThumbnailMediaId");
    }
  });
});

describe("addVideo — EC7: markup in title/description stored as plain text", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireStaff).mockResolvedValue(STAFF as never);
    vi.mocked(writeAuditRow).mockResolvedValue(undefined);
    vi.mocked(copyYouTubeThumbnail).mockResolvedValue({
      ok: true,
      thumbnailKey: "thumbnails/dQw4w9WgXcQ.jpg",
      thumbnailSource: "youtube_copy",
    });
  });

  it("stores <script> in title as-is (no stripping or encoding)", async () => {
    const xssTitle = '<script>alert(1)</script>';
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(
      makeSupabase({ insertData: { ...SAVED_ROW, title: xssTitle } })
    );
    const result = await addVideo({
      youtubeLink: "https://youtu.be/dQw4w9WgXcQ",
      title: xssTitle,
      categoryId: CAT_ID,
    });
    const supabase = vi.mocked(createSupabaseServiceRoleClient).mock.results.at(-1)!.value;
    const insertCall = vi.mocked(supabase.from).mock.results[0]?.value?.insert?.mock?.calls?.[0]?.[0];
    expect(insertCall?.title).toBe(xssTitle);
    if (result.ok) expect(result.video.title).toBe(xssTitle);
  });

  it("stores markup in description as-is", async () => {
    const xssDesc = '<img src=x onerror=alert(1)>';
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(
      makeSupabase({ insertData: { ...SAVED_ROW, description: xssDesc } })
    );
    await addVideo({
      youtubeLink: "https://youtu.be/dQw4w9WgXcQ",
      title: "Normal Title",
      description: xssDesc,
      categoryId: CAT_ID,
    });
    const supabase = vi.mocked(createSupabaseServiceRoleClient).mock.results.at(-1)!.value;
    const insertCall = vi.mocked(supabase.from).mock.results[0]?.value?.insert?.mock?.calls?.[0]?.[0];
    expect(insertCall?.description).toBe(xssDesc);
  });
});
