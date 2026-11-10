// S-071 AC6: listDocumentPickerItems permission unit tests.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("@/lib/config", () => ({
  serverConfig: { documentsPageSize: 12, previewRateLimitPerMinute: 60 },
  r2Config: () => null,
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAnonClient: vi.fn(),
  createSupabaseServiceRoleClient: vi.fn(),
}));
vi.mock("@/lib/auth/server", () => ({ requireStaff: vi.fn() }));
vi.mock("@/lib/ratelimit/index", () => ({ checkRateLimit: vi.fn() }));

import { requireStaff } from "@/lib/auth/server";
import { createSupabaseAnonClient } from "@/lib/supabase/server";
import { listDocumentPickerItems } from "@/lib/documents/public";

const mockRequireStaff = vi.mocked(requireStaff);
const mockAnonClient = vi.mocked(createSupabaseAnonClient);

beforeEach(() => vi.clearAllMocks());

describe("listDocumentPickerItems — permission (AC6)", () => {
  it("returns not_allowed when staff check fails (S2: wrong role)", async () => {
    mockRequireStaff.mockResolvedValue({ ok: false, code: "not_allowed" } as never);
    const result = await listDocumentPickerItems({});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_allowed");
    // Supabase must NOT be called when auth fails
    expect(mockAnonClient).not.toHaveBeenCalled();
  });

  it("calls requireStaff with articles.* permission (AC6)", async () => {
    mockRequireStaff.mockResolvedValue({ ok: false, code: "not_allowed" } as never);
    await listDocumentPickerItems({});
    expect(mockRequireStaff).toHaveBeenCalledWith("articles.*");
  });

  it("returns items when staff check passes", async () => {
    mockRequireStaff.mockResolvedValue({ ok: true } as never);

    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockLte = vi.fn().mockReturnThis();
    const mockIs = vi.fn().mockReturnThis();
    const mockRange = vi.fn().mockReturnThis();
    const mockIlike = vi.fn().mockReturnThis();
    const mockFrom = vi.fn(() => ({
      select: mockSelect,
      eq: mockEq,
      lte: mockLte,
      is: mockIs,
      range: mockRange,
      ilike: mockIlike,
    }));

    // Chain: select → eq → lte → is → range returns the data promise
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ lte: mockLte, eq: mockEq });
    mockLte.mockReturnValue({ is: mockIs });
    mockIs.mockReturnValue({ range: mockRange });
    mockRange.mockResolvedValue({
      data: [{ id: "doc-1", slug: "s", title: "T", cover_image_key: null, price_cents: 500 }],
      error: null,
    });

    mockAnonClient.mockReturnValue({ from: mockFrom } as never);

    const result = await listDocumentPickerItems({});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.items).toHaveLength(1);
      expect(result.items[0].kind).toBe("document");
      // No file_key in picker items (AC2)
      expect(result.items[0]).not.toHaveProperty("fileKey");
      expect(result.items[0]).not.toHaveProperty("file_key");
    }
  });
});
