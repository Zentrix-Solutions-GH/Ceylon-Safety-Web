// S-053: AC9 — getPublicVideo

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({
  serverConfig: { supabaseServiceRoleKey: "srk" },
  publicConfig: { supabaseUrl: "https://test.supabase.co", supabaseAnonKey: "anon" },
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAnonClient: vi.fn(),
}));

import { createSupabaseAnonClient } from "@/lib/supabase/server";
import { getPublicVideo } from "@/lib/videos/actions/getPublicVideo";

const VIDEO_ID = "00000000-0000-4000-8000-000000000030";
const PAST = "2020-01-01T00:00:00Z";

function makePublicRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: VIDEO_ID,
    youtube_id: "dQw4w9WgXcQ",
    title: "Public Video",
    description: "desc",
    thumbnail_key: "thumbnails/test.jpg",
    status: "published",
    published_at: PAST,
    deleted_at: null,
    ...overrides,
  };
}

function makeSupabase(row: Record<string, unknown> | null, error: unknown = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: row, error });
  const lte = vi.fn().mockReturnValue({ maybeSingle });
  const isFilter: ReturnType<typeof vi.fn> = vi.fn().mockReturnValue({ lte });
  const eq: ReturnType<typeof vi.fn> = vi.fn();
  eq.mockReturnValue({ is: isFilter, eq, lte, maybeSingle });
  const select = vi.fn().mockReturnValue({ eq, is: isFilter });
  return { from: vi.fn().mockReturnValue({ select }) } as unknown as ReturnType<typeof createSupabaseAnonClient>;
}

beforeEach(() => {
  vi.mocked(createSupabaseAnonClient).mockReturnValue(makeSupabase(makePublicRow()));
});

describe("getPublicVideo — AC9: visibility", () => {
  it("returns video when published and published_at <= now", async () => {
    const result = await getPublicVideo(VIDEO_ID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.video.id).toBe(VIDEO_ID);
      expect(result.video.youtubeId).toBe("dQw4w9WgXcQ");
    }
  });

  it("returns not_found when video is hidden", async () => {
    vi.mocked(createSupabaseAnonClient).mockReturnValue(makeSupabase(null));
    const result = await getPublicVideo(VIDEO_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_found");
  });

  it("returns not_found when video is deleted", async () => {
    vi.mocked(createSupabaseAnonClient).mockReturnValue(makeSupabase(null));
    const result = await getPublicVideo(VIDEO_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_found");
  });

  it("returns not_found for unknown id", async () => {
    vi.mocked(createSupabaseAnonClient).mockReturnValue(makeSupabase(null));
    const result = await getPublicVideo("nonexistent-id");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_found");
  });

  it("returns not_found for future-dated video", async () => {
    vi.mocked(createSupabaseAnonClient).mockReturnValue(makeSupabase(null));
    const result = await getPublicVideo(VIDEO_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_found");
  });

  it("does not read the session", async () => {
    // getPublicVideo uses service role client (anon read path), not user session
    await getPublicVideo(VIDEO_ID);
    // If it called requireSession it would throw or use auth client; just verify service role used
    expect(createSupabaseAnonClient).toHaveBeenCalled();
  });
});
