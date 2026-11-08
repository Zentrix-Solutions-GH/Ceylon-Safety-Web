// S-053: EC6 — permission matrix for all video actions

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
vi.mock("@/lib/cache/purge", () => ({
  purgeVideo: vi.fn(),
}));

import { requireStaff } from "@/lib/auth/server";
import { writeAuditRow } from "@/lib/audit/index";
import { addVideo } from "@/lib/videos/actions/addVideo";
import { updateVideo } from "@/lib/videos/actions/updateVideo";
import { setVideoStatus } from "@/lib/videos/actions/setVideoStatus";
import { listAdminVideos } from "@/lib/videos/actions/listAdminVideos";

const NOT_ALLOWED = { ok: false as const, code: "not_allowed" as const };
const CAT = "00000000-0000-4000-8000-000000000020";
const VID = "00000000-0000-4000-8000-000000000030";

beforeEach(() => {
  vi.mocked(requireStaff).mockResolvedValue(NOT_ALLOWED as never);
  vi.mocked(writeAuditRow).mockResolvedValue(undefined);
});

describe("EC6: caller without videos.* gets not_allowed", () => {
  it("addVideo returns not_allowed", async () => {
    const result = await addVideo({ youtubeLink: "https://youtu.be/dQw4w9WgXcQ", title: "T", categoryId: CAT });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_allowed");
  });

  it("addVideo writes permission.denied audit row", async () => {
    await addVideo({ youtubeLink: "https://youtu.be/dQw4w9WgXcQ", title: "T", categoryId: CAT });
    expect(writeAuditRow).toHaveBeenCalledWith(expect.objectContaining({ action: "permission.denied" }));
  });

  it("updateVideo returns not_allowed", async () => {
    const result = await updateVideo({ id: VID, title: "T", updatedAt: "2026-01-01T00:00:00Z" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_allowed");
  });

  it("updateVideo writes permission.denied audit row", async () => {
    await updateVideo({ id: VID, title: "T", updatedAt: "2026-01-01T00:00:00Z" });
    expect(writeAuditRow).toHaveBeenCalledWith(expect.objectContaining({ action: "permission.denied" }));
  });

  it("setVideoStatus returns not_allowed", async () => {
    const result = await setVideoStatus({ id: VID, action: "hide", updatedAt: "2026-01-01T00:00:00Z" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_allowed");
  });

  it("setVideoStatus writes permission.denied audit row", async () => {
    await setVideoStatus({ id: VID, action: "hide", updatedAt: "2026-01-01T00:00:00Z" });
    expect(writeAuditRow).toHaveBeenCalledWith(expect.objectContaining({ action: "permission.denied" }));
  });

  it("listAdminVideos returns not_allowed", async () => {
    const result = await listAdminVideos({});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_allowed");
  });
});
