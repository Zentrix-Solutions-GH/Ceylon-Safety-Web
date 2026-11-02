// S-036 AC3: pending-reset cookie settings
// Verifies httpOnly, SameSite=Lax, maxAge=900, path="/" match the spec (auth design §6 + §8).

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const mockCookieSet = vi.fn();
const mockCookieGet = vi.fn();
const mockCookieDelete = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    set: mockCookieSet,
    get: mockCookieGet,
    delete: mockCookieDelete,
  }),
}));

describe("pending-reset cookie (AC3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("setPendingReset writes httpOnly, SameSite=Lax, maxAge=900, path=/", async () => {
    const { setPendingReset } = await import("@/lib/auth/cookies");
    await setPendingReset({ email: "user@example.com" });

    expect(mockCookieSet).toHaveBeenCalledWith(
      "pending_reset",
      expect.any(String),
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        maxAge: 900,
        path: "/",
      })
    );
    const [, value] = mockCookieSet.mock.calls[0];
    expect(JSON.parse(value)).toEqual({ email: "user@example.com" });
  });

  it("getPendingReset returns null when cookie absent", async () => {
    mockCookieGet.mockReturnValue(undefined);
    const { getPendingReset } = await import("@/lib/auth/cookies");
    const result = await getPendingReset();
    expect(result).toBeNull();
  });

  it("getPendingReset returns null for malformed JSON", async () => {
    mockCookieGet.mockReturnValue({ value: "not-json" });
    const { getPendingReset } = await import("@/lib/auth/cookies");
    const result = await getPendingReset();
    expect(result).toBeNull();
  });

  it("clearPendingReset deletes the cookie", async () => {
    const { clearPendingReset } = await import("@/lib/auth/cookies");
    await clearPendingReset();
    expect(mockCookieDelete).toHaveBeenCalledWith("pending_reset");
  });
});
