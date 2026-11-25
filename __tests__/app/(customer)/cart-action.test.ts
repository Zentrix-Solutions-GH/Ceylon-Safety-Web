// S-091: removeFromCartAction — S3 (bad UUID), auth pass-through from lib
import { describe, it, expect, vi, beforeEach } from "vitest";

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

describe("removeFromCartAction — input validation", () => {
  it("S3: returns validation_failed for a non-UUID string without calling removeFromCart", async () => {
    const result = await removeFromCartAction("not-a-uuid");
    expect(result).toEqual({ ok: false, code: "validation_failed" });
    expect(mockRemoveFromCart).not.toHaveBeenCalled();
  });

  it("S3: returns validation_failed for an empty string without calling removeFromCart", async () => {
    const result = await removeFromCartAction("");
    expect(result).toEqual({ ok: false, code: "validation_failed" });
    expect(mockRemoveFromCart).not.toHaveBeenCalled();
  });
});

describe("removeFromCartAction — delegates to lib", () => {
  it("delegates to removeFromCart with the validated UUID and returns ok", async () => {
    mockRemoveFromCart.mockResolvedValue({ ok: true });
    const result = await removeFromCartAction(VALID_UUID);
    expect(mockRemoveFromCart).toHaveBeenCalledWith(VALID_UUID);
    expect(result).toEqual({ ok: true });
  });

  it("passes through not_signed_in from removeFromCart (S1: no session)", async () => {
    mockRemoveFromCart.mockResolvedValue({ ok: false, code: "not_signed_in" });
    const result = await removeFromCartAction(VALID_UUID);
    expect(result).toEqual({ ok: false, code: "not_signed_in" });
  });

  it("passes through not_allowed from removeFromCart (S17: suspended/reauth)", async () => {
    mockRemoveFromCart.mockResolvedValue({ ok: false, code: "not_allowed" });
    const result = await removeFromCartAction(VALID_UUID);
    expect(result).toEqual({ ok: false, code: "not_allowed" });
  });

  it("passes through not_found from removeFromCart", async () => {
    mockRemoveFromCart.mockResolvedValue({ ok: false, code: "not_found" });
    const result = await removeFromCartAction(VALID_UUID);
    expect(result).toEqual({ ok: false, code: "not_found" });
  });
});
