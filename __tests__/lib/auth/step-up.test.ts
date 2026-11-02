// S-038 AC5 / EC3: requireStepUp asks for fresh TOTP code before money actions.
// A correct code is valid for 5 minutes (300 s) for further money actions.
// A code used 6+ minutes ago is refused.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config.upstash", () => ({ upstashConfig: vi.fn().mockReturnValue(null) }));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireStepUp, _resetCacheForTest } from "@/lib/auth/step-up";

const mockListFactors = vi.fn();
const mockChallenge = vi.fn();
const mockVerify = vi.fn();

describe("requireStepUp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset module-level _memCache so actor IDs don't carry state between tests.
    _resetCacheForTest();
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: {
        mfa: {
          listFactors: mockListFactors,
          challenge: mockChallenge,
          verify: mockVerify,
        },
      },
    } as never);
    // Enrolled verified TOTP factor by default
    mockListFactors.mockResolvedValue({
      data: { totp: [{ id: "factor-uuid-123", factor_type: "totp", status: "verified" }] },
      error: null,
    });
    // Successful challenge + verify by default
    mockChallenge.mockResolvedValue({ data: { id: "challenge-id" }, error: null });
    mockVerify.mockResolvedValue({ data: {}, error: null });
  });

  it("AC5: throws mfa_required when no code provided", async () => {
    await expect(requireStepUp("actor-1", undefined)).rejects.toMatchObject({
      code: "mfa_required",
    });
    expect(mockListFactors).not.toHaveBeenCalled();
    expect(mockChallenge).not.toHaveBeenCalled();
  });

  it("AC5: passes when code is valid (Supabase verify succeeds)", async () => {
    await expect(requireStepUp("actor-2", "123456")).resolves.toBeUndefined();
    expect(mockVerify).toHaveBeenCalledTimes(1);
  });

  it("AC5: throws mfa_required when Supabase verify fails (wrong code)", async () => {
    mockVerify.mockResolvedValue({ data: null, error: { message: "invalid code" } });
    await expect(requireStepUp("actor-3", "999999")).rejects.toMatchObject({
      code: "mfa_required",
    });
  });

  it("AC5: throws mfa_required when no enrolled TOTP factor found", async () => {
    mockListFactors.mockResolvedValue({ data: { totp: [] }, error: null });
    await expect(requireStepUp("actor-no-factor", "123456")).rejects.toMatchObject({
      code: "mfa_required",
    });
    expect(mockChallenge).not.toHaveBeenCalled();
  });

  it("AC5: second call within 5 min skips Supabase verify (cached)", async () => {
    // First call — hits Supabase
    await requireStepUp("actor-cache", "123456");
    expect(mockVerify).toHaveBeenCalledTimes(1);

    // Second call — uses cache
    vi.clearAllMocks();
    await expect(requireStepUp("actor-cache", undefined)).resolves.toBeUndefined();
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it("EC3: cache expired after 300s — code required again", async () => {
    vi.useFakeTimers();

    await requireStepUp("actor-expired", "123456");
    expect(mockVerify).toHaveBeenCalledTimes(1);

    // Advance past 5-minute window
    vi.advanceTimersByTime(301_000);
    vi.clearAllMocks();

    await expect(requireStepUp("actor-expired", undefined)).rejects.toMatchObject({
      code: "mfa_required",
    });

    vi.useRealTimers();
  });

  it("P1: listFactors network error propagates (not converted to mfa_required)", async () => {
    mockListFactors.mockRejectedValue(new Error("network error"));
    await expect(requireStepUp("actor-network-err", "123456")).rejects.toThrow("network error");
  });

  it("AC5: cache is per-actor (different actors don't share)", async () => {
    await requireStepUp("actor-A", "111111");
    vi.clearAllMocks();

    // actor-B has no cached step-up
    mockVerify.mockResolvedValue({ data: null, error: { message: "invalid" } });
    await expect(requireStepUp("actor-B", undefined)).rejects.toMatchObject({
      code: "mfa_required",
    });
  });
});
