import { describe, it, expect, beforeEach } from "vitest";
import {
  getConsent,
  setConsent,
  isAdAllowed,
  isAnalyticsAllowed,
} from "../index";

// Helpers — use the real jsdom cookie jar (URL is https://localhost via vitest config)
const NOW_S = Math.floor(Date.now() / 1000);
const AGO_181_DAYS_S = NOW_S - 181 * 24 * 60 * 60;

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; Path=/`;
}

function clearAllCookies() {
  document.cookie.split(";").forEach((c) => {
    const name = c.split("=")[0].trim();
    if (name) document.cookie = `${name}=; Max-Age=0; Path=/`;
  });
}

// setCookieRaw sets both hs_consent and hs_consent_ts from a raw cookie string
// Format: "hs_consent=accepted; hs_consent_ts=<ts>"
function setCookieRaw(rawPairs: string) {
  clearAllCookies();
  rawPairs.split(";").forEach((pair) => {
    const [name, ...rest] = pair.trim().split("=");
    if (name?.trim()) setCookie(name.trim(), rest.join("=").trim());
  });
}

beforeEach(() => {
  clearAllCookies();
});

// ── AC1 / AC3: three states, default undecided ───────────────────────────────

describe("getConsent — states", () => {
  it("returns undecided when no cookie is set (AC1, AC3)", () => {
    expect(getConsent()).toBe("undecided");
  });

  it("returns accepted when cookie is accepted and fresh (AC1)", () => {
    setCookieRaw(`hs_consent=accepted; hs_consent_ts=${NOW_S}`);
    expect(getConsent()).toBe("accepted");
  });

  it("returns rejected when cookie is rejected and fresh (AC1)", () => {
    setCookieRaw(`hs_consent=rejected; hs_consent_ts=${NOW_S}`);
    expect(getConsent()).toBe("rejected");
  });

  // EC3
  it("returns undecided for an unknown cookie value (EC3)", () => {
    setCookieRaw(`hs_consent=maybe; hs_consent_ts=${NOW_S}`);
    expect(getConsent()).toBe("undecided");
  });

  // EC2 — cookie older than 180 days
  it("returns undecided when cookie is older than 180 days (EC2)", () => {
    setCookieRaw(`hs_consent=accepted; hs_consent_ts=${AGO_181_DAYS_S}`);
    expect(getConsent()).toBe("undecided");
  });

  // AC3 — missing timestamp treated as undecided
  it("returns undecided when timestamp cookie is missing (AC3)", () => {
    setCookieRaw("hs_consent=accepted");
    expect(getConsent()).toBe("undecided");
  });
});

// ── AC2 / AC4: setConsent writes and withdraws ───────────────────────────────

describe("setConsent", () => {
  it("returns ok:true and makes getConsent return accepted (AC2, AC4)", () => {
    const result = setConsent("accepted");
    expect(result.ok).toBe(true);
    // After writing we read the cookie back via getConsent
    expect(getConsent()).toBe("accepted");
  });

  it("returns ok:true and makes getConsent return rejected (AC4)", () => {
    setConsent("rejected");
    expect(getConsent()).toBe("rejected");
  });

  it("overwrites a previous choice (AC4 — withdrawal)", () => {
    setConsent("accepted");
    setConsent("rejected");
    expect(getConsent()).toBe("rejected");
  });

  // EC1 — cookies blocked: simulate by intercepting document.cookie
  it("returns ok:false when document.cookie is blocked (EC1)", () => {
    Object.defineProperty(document, "cookie", {
      get: () => "",
      set: () => { /* silently ignore writes */ },
      configurable: true,
    });

    const result = setConsent("accepted");
    expect(result.ok).toBe(false);

    // Restore — delete the own-property override so prototype getter takes over
    delete (document as unknown as Record<string, unknown>).cookie;
  });
});

// ── AC5 / EC7 / EC8: isAdAllowed gate ────────────────────────────────────────

describe("isAdAllowed", () => {
  beforeEach(() => {
    setCookieRaw(`hs_consent=accepted; hs_consent_ts=${NOW_S}`);
  });

  it("allows / when accepted (AC5)", () => {
    expect(isAdAllowed("/")).toBe(true);
  });

  it("allows /articles when accepted (AC5)", () => {
    expect(isAdAllowed("/articles")).toBe(true);
  });

  it("allows /articles/some-slug when accepted (AC5)", () => {
    expect(isAdAllowed("/articles/some-slug")).toBe(true);
  });

  it("denies /documents even when accepted (AC5 — not on ad list)", () => {
    expect(isAdAllowed("/documents")).toBe(false);
  });

  it("denies /courses even when accepted (AC5 — Phase 1 exclusion)", () => {
    expect(isAdAllowed("/courses")).toBe(false);
  });

  it("denies any path when state is rejected (AC5)", () => {
    setCookieRaw(`hs_consent=rejected; hs_consent_ts=${NOW_S}`);
    expect(isAdAllowed("/")).toBe(false);
  });

  it("denies any path when state is undecided (AC5)", () => {
    clearAllCookies();
    expect(isAdAllowed("/")).toBe(false);
  });

  // EC7 — paths not on allow-list
  it("denies /contact regardless of state (EC7)", () => {
    expect(isAdAllowed("/contact")).toBe(false);
  });

  it("denies /cart regardless of state (EC7)", () => {
    expect(isAdAllowed("/cart")).toBe(false);
  });

  // EC8 — auth/customer/checkout/admin paths
  it("denies /login (auth path) (EC8)", () => {
    expect(isAdAllowed("/login")).toBe(false);
  });

  it("denies /checkout regardless of state (EC8)", () => {
    expect(isAdAllowed("/checkout")).toBe(false);
  });

  it("denies /account regardless of state (EC8)", () => {
    expect(isAdAllowed("/account")).toBe(false);
  });

  it("denies /admin regardless of state (EC8)", () => {
    expect(isAdAllowed("/admin")).toBe(false);
  });
});

// ── AC5 / EC7 / EC8: isAnalyticsAllowed gate ─────────────────────────────────

describe("isAnalyticsAllowed", () => {
  beforeEach(() => {
    setCookieRaw(`hs_consent=accepted; hs_consent_ts=${NOW_S}`);
  });

  it("allows / (AC5)", () => {
    expect(isAnalyticsAllowed("/")).toBe(true);
  });

  it("allows /articles/some-slug (AC5)", () => {
    expect(isAnalyticsAllowed("/articles/some-slug")).toBe(true);
  });

  it("allows /documents/some-slug (AC5)", () => {
    expect(isAnalyticsAllowed("/documents/some-slug")).toBe(true);
  });

  it("allows /videos/some-slug (AC5)", () => {
    expect(isAnalyticsAllowed("/videos/some-slug")).toBe(true);
  });

  it("denies /courses (Phase 1 exclusion) (AC5)", () => {
    expect(isAnalyticsAllowed("/courses")).toBe(false);
  });

  it("denies when rejected (AC5)", () => {
    setCookieRaw(`hs_consent=rejected; hs_consent_ts=${NOW_S}`);
    expect(isAnalyticsAllowed("/")).toBe(false);
  });

  it("denies /admin (EC8)", () => {
    expect(isAnalyticsAllowed("/admin")).toBe(false);
  });

  it("denies /checkout (EC8)", () => {
    expect(isAnalyticsAllowed("/checkout")).toBe(false);
  });

  it("denies /login (EC8)", () => {
    expect(isAnalyticsAllowed("/login")).toBe(false);
  });

  it("denies /account (EC8)", () => {
    expect(isAnalyticsAllowed("/account")).toBe(false);
  });

  // EC7 — paths not on analytics allow-list
  it("denies /contact regardless of state (EC7)", () => {
    expect(isAnalyticsAllowed("/contact")).toBe(false);
  });

  it("denies /cart regardless of state (EC7)", () => {
    expect(isAnalyticsAllowed("/cart")).toBe(false);
  });
});

// ── AC7: WhatsApp analytics event gate ───────────────────────────────────────

describe("isAnalyticsAllowed — WhatsApp path (AC7)", () => {
  it("allows WhatsApp analytics event when accepted on an allowed page", () => {
    setCookieRaw(`hs_consent=accepted; hs_consent_ts=${NOW_S}`);
    // WhatsApp analytics is gated by accepted state; path check is caller's job
    // We expose the same isAnalyticsAllowed helper; caller passes current path
    expect(isAnalyticsAllowed("/")).toBe(true);
  });

  it("denies WhatsApp analytics event when rejected", () => {
    setCookieRaw(`hs_consent=rejected; hs_consent_ts=${NOW_S}`);
    expect(isAnalyticsAllowed("/")).toBe(false);
  });
});

// ── EC4: two-tab behaviour ────────────────────────────────────────────────────

describe("EC4 — two tabs", () => {
  it("getConsent reflects the latest cookie value (simulates other tab writing)", () => {
    setConsent("accepted");
    // Simulate other tab changing the cookie directly
    setCookieRaw(`hs_consent=rejected; hs_consent_ts=${NOW_S}`);
    expect(getConsent()).toBe("rejected");
  });
});
