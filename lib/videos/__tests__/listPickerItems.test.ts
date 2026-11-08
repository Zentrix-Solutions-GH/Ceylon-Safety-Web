// S-053: AC10 — listPickerItems

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
import { listPickerItems } from "@/lib/videos/actions/listPickerItems";

const STAFF = { ok: true as const, user: { id: "staff-1", claimedRole: "admin" as const } };

function makeRows(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `video-${i}`,
    title: `Video ${i}`,
    thumbnail_key: `thumbnails/vid${i}.jpg`,
  }));
}

function makeSupabase(rows: unknown[], error: unknown = null) {
  const range = vi.fn().mockResolvedValue({ data: rows, error });
  const ilike = vi.fn().mockReturnValue({ range });
  const lte: ReturnType<typeof vi.fn> = vi.fn().mockReturnValue({ ilike, range });
  const is: ReturnType<typeof vi.fn> = vi.fn().mockReturnValue({ lte, ilike, range });
  const eq: ReturnType<typeof vi.fn> = vi.fn();
  eq.mockReturnValue({ ilike, range, eq, is, lte });
  const select = vi.fn().mockReturnValue({ eq, is, range, lte });
  return { from: vi.fn().mockReturnValue({ select }) } as unknown as ReturnType<typeof createSupabaseServiceRoleClient>;
}

beforeEach(() => {
  vi.mocked(requireStaff).mockResolvedValue(STAFF as never);
  vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(makeSupabase(makeRows(5)));
});

describe("listPickerItems — AC10", () => {
  it("requires articles.* permission", async () => {
    await listPickerItems({ kind: "video" });
    expect(requireStaff).toHaveBeenCalledWith("articles.*");
  });

  it("returns not_allowed for missing permission", async () => {
    vi.mocked(requireStaff).mockResolvedValue({ ok: false, code: "not_allowed" } as never);
    const result = await listPickerItems({ kind: "video" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_allowed");
  });

  it("returns 20 items per page", async () => {
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(makeSupabase(makeRows(21)));
    const result = await listPickerItems({ kind: "video" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.items.length).toBeLessThanOrEqual(20);
  });

  it("sets hasMore = true when more than 20 items returned from DB", async () => {
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(makeSupabase(makeRows(21)));
    const result = await listPickerItems({ kind: "video" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.hasMore).toBe(true);
  });

  it("sets hasMore = false when fewer than 21 items", async () => {
    const result = await listPickerItems({ kind: "video" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.hasMore).toBe(false);
  });

  it("returns items with thumbnailKey and kind = video", async () => {
    const result = await listPickerItems({ kind: "video" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      for (const item of result.items) {
        expect(item.kind).toBe("video");
        expect(item.thumbnailKey).toBeTruthy();
      }
    }
  });
});
