// S-091: lib/cart/count — getCartCount unit tests
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockFrom = vi.fn(() => ({ select: mockSelect }));
mockSelect.mockReturnValue({ eq: mockEq });

const mockSupabase = { from: mockFrom };
const mockCreateClient = vi.fn(() => Promise.resolve(mockSupabase));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => mockCreateClient(),
}));

import { getCartCount } from "@/lib/cart/count";

describe("getCartCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ select: mockSelect });
  });

  it("returns the count for a given userId", async () => {
    mockEq.mockResolvedValue({ count: 3, error: null });

    const result = await getCartCount("user-abc");

    expect(mockFrom).toHaveBeenCalledWith("cart_items");
    expect(mockEq).toHaveBeenCalledWith("user_id", "user-abc");
    expect(result).toBe(3);
  });

  it("returns 0 when count is null", async () => {
    mockEq.mockResolvedValue({ count: null, error: null });

    expect(await getCartCount("user-abc")).toBe(0);
  });

  it("returns 0 on Supabase error", async () => {
    mockEq.mockResolvedValue({ count: null, error: { message: "db error" } });

    expect(await getCartCount("user-abc")).toBe(0);
  });

  it("returns 0 when createSupabaseServerClient throws", async () => {
    mockCreateClient.mockRejectedValueOnce(new Error("connection failed"));

    expect(await getCartCount("user-abc")).toBe(0);
  });
});
