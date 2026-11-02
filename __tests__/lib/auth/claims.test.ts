import { describe, it, expect } from "vitest";
import { buildSessionUser, isWithinStaffWindow, STAFF_WINDOW_HOURS } from "@/lib/auth/claims";

const NOW_ISO = new Date().toISOString();

function baseUser(overrides: object = {}) {
  return {
    id: "u1",
    email: "u@example.com",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: NOW_ISO,
    ...overrides,
  };
}

describe("buildSessionUser — EC4: AMR fallback to last_sign_in_at", () => {
  it("uses last_sign_in_at when amr is absent", () => {
    const signInTime = new Date(Date.now() - 3600 * 1000).toISOString();
    const user = buildSessionUser(
      baseUser({ last_sign_in_at: signInTime }) as never
    );

    expect(user.lastFullSignIn).toBe(signInTime);
    expect(user.hasAuthenticatorLevel).toBe(false);
  });

  it("uses last_sign_in_at when amr array is empty", () => {
    const signInTime = new Date(Date.now() - 7200 * 1000).toISOString();
    const user = buildSessionUser(
      baseUser({ last_sign_in_at: signInTime, amr: [] }) as never
    );

    expect(user.lastFullSignIn).toBe(signInTime);
    expect(user.hasAuthenticatorLevel).toBe(false);
  });

  it("prefers the AMR password timestamp over last_sign_in_at when AMR is present", () => {
    const amrTs = Math.floor(Date.now() / 1000) - 1800;
    const oldSignIn = new Date(Date.now() - 10 * 3600 * 1000).toISOString();
    const user = buildSessionUser(
      baseUser({
        last_sign_in_at: oldSignIn,
        amr: [{ method: "password", timestamp: amrTs }],
      }) as never
    );

    const expectedIso = new Date(amrTs * 1000).toISOString();
    expect(user.lastFullSignIn).toBe(expectedIso);
  });

  it("sets hasAuthenticatorLevel true only when totp appears in amr", () => {
    const ts = Math.floor(Date.now() / 1000) - 600;
    const withTotp = buildSessionUser(
      baseUser({ amr: [{ method: "password", timestamp: ts }, { method: "totp", timestamp: ts }] }) as never
    );
    const withoutTotp = buildSessionUser(
      baseUser({ amr: [{ method: "password", timestamp: ts }] }) as never
    );

    expect(withTotp.hasAuthenticatorLevel).toBe(true);
    expect(withoutTotp.hasAuthenticatorLevel).toBe(false);
  });
});

describe("isWithinStaffWindow", () => {
  it(`returns true for a sign-in less than ${STAFF_WINDOW_HOURS}h ago`, () => {
    const recent = new Date(Date.now() - (STAFF_WINDOW_HOURS - 1) * 3600 * 1000).toISOString();
    expect(isWithinStaffWindow(recent)).toBe(true);
  });

  it(`returns false for a sign-in more than ${STAFF_WINDOW_HOURS}h ago`, () => {
    const stale = new Date(Date.now() - (STAFF_WINDOW_HOURS + 1) * 3600 * 1000).toISOString();
    expect(isWithinStaffWindow(stale)).toBe(false);
  });

  it("returns false when lastFullSignIn is undefined (EC4 — no AMR, no last_sign_in_at)", () => {
    expect(isWithinStaffWindow(undefined)).toBe(false);
  });
});
