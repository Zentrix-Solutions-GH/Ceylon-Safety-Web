// S-099: Bank helpers integration tests — AC5, EC3
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: vi.fn(),
}));
vi.mock("@/lib/auth/step-up", () => ({
  requireStepUp: vi.fn(),
  _resetCacheForTest: vi.fn(),
}));

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireStepUp, _resetCacheForTest } from "@/lib/auth/step-up";
import { checkBankOrderPending, enforceStepUpForBank } from "@/lib/settings/bank";

function makeDb(hasPendingOrder: boolean) {
  const countResult = hasPendingOrder
    ? { count: 1, error: null }
    : { count: 0, error: null };
  const chain: Record<string, unknown> = {
    select: () => chain,
    eq: () => chain,
    in: () => chain,
    then(resolve: (v: unknown) => unknown) {
      return Promise.resolve(countResult).then(resolve);
    },
    catch(reject: (e: unknown) => unknown) {
      return Promise.resolve(countResult).catch(reject);
    },
  };
  return { from: () => chain };
}

describe("checkBankOrderPending", () => {
  it("EC3: returns true when a bank order is pending_verification", async () => {
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(makeDb(true) as never);
    const result = await checkBankOrderPending();
    expect(result).toBe(true);
  });

  it("EC3: returns false when no bank order is pending", async () => {
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(makeDb(false) as never);
    const result = await checkBankOrderPending();
    expect(result).toBe(false);
  });
});

describe("enforceStepUpForBank", () => {
  beforeEach(() => {
    vi.mocked(requireStepUp).mockReset();
    vi.mocked(_resetCacheForTest).mockReset();
  });

  it("AC5: calls requireStepUp with actor id and code", async () => {
    vi.mocked(requireStepUp).mockResolvedValue(undefined);
    await enforceStepUpForBank("user-001", "123456");
    expect(requireStepUp).toHaveBeenCalledWith("user-001", "123456");
  });

  it("AC5: without code, requireStepUp is called with undefined (cache check)", async () => {
    vi.mocked(requireStepUp).mockResolvedValue(undefined);
    await enforceStepUpForBank("user-001", undefined);
    expect(requireStepUp).toHaveBeenCalledWith("user-001", undefined);
  });

  it("AC5: propagates mfa_required when requireStepUp throws", async () => {
    vi.mocked(requireStepUp).mockRejectedValue(
      Object.assign(new Error("mfa_required"), { code: "mfa_required" })
    );
    await expect(enforceStepUpForBank("user-001", "wrong")).rejects.toMatchObject({
      code: "mfa_required",
    });
  });
});
