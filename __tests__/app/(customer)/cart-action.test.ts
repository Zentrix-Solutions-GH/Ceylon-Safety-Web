// S-091: removeFromCartAction — S1 (no session), S2/S17 (suspended), S3 (bad UUID)
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireActiveAccount = vi.fn();
vi.mock("@/lib/auth/server", () => ({
  requireActiveAccount: () => mockRequireActiveAccount(),
}));

const mockRemoveFromCart = vi.fn();
vi.mock("@/lib/cart/index", () => ({
  removeFromCart: (id: string) => mockRemoveFromCart(id),
}));

import { removeFromCartAction } from "@/app/(customer)/cart/actions";

const VALID_UUID = "123e4567-e89b-12d3-a456-426614174000";

beforeEach(() => {
  vi.clearAllMocks();
  mockRemoveFromCart.mockResolvedValue({ ok: true });
});

describe("removeFromCartAction — authentication", () => {
  it("S1: returns not_signed_in when there is no session", async () => {
    mockRequireActiveAccount.mockResolvedValue({ ok: false, code: "not_authenticated" });
    const result = await removeFromCartAction(VALID_UUID);
    expect(result).toEqual({ ok: false, code: "not_signed_in" });
    expect(mockRemoveFromCart).not.toHaveBeenCalled();
  });

  it("S17: returns not_allowed when account is suspended", async () => {
    mockRequireActiveAccount.mockResolvedValue({ ok: false, code: "account_suspended" });
    const result = await removeFromCartAction(VALID_UUID);
    expect(result).toEqual({ ok: false, code: "not_allowed" });
    expect(mockRemoveFromCart).not.toHaveBeenCalled();
  });
});

describe("removeFromCartAction — input validation", () => {
  it("S3: returns validation_failed for a non-UUID string", async () => {
    mockRequireActiveAccount.mockResolvedValue({ ok: true, user: { id: "user-1" } });
    const result = await removeFromCartAction("not-a-uuid");
    expect(result).toEqual({ ok: false, code: "validation_failed" });
    expect(mockRemoveFromCart).not.toHaveBeenCalled();
  });

  it("S3: returns validation_failed for an empty string", async () => {
    mockRequireActiveAccount.mockResolvedValue({ ok: true, user: { id: "user-1" } });
    const result = await removeFromCartAction("");
    expect(result).toEqual({ ok: false, code: "validation_failed" });
    expect(mockRemoveFromCart).not.toHaveBeenCalled();
  });
});

describe("removeFromCartAction — happy path", () => {
  it("delegates to removeFromCart with the validated UUID and returns ok", async () => {
    mockRequireActiveAccount.mockResolvedValue({ ok: true, user: { id: "user-1" } });
    mockRemoveFromCart.mockResolvedValue({ ok: true });
    const result = await removeFromCartAction(VALID_UUID);
    expect(mockRemoveFromCart).toHaveBeenCalledWith(VALID_UUID);
    expect(result).toEqual({ ok: true });
  });
});
