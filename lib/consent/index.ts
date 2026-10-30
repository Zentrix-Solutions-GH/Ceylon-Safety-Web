import type { ConsentState, ConsentChoice } from "@/types/consent";

const COOKIE_NAME = "hs_consent";
const COOKIE_TS_NAME = "hs_consent_ts";
// 180 days in seconds
const LIFETIME_S = 180 * 24 * 60 * 60;

function parseCookies(): Record<string, string> {
  if (typeof document === "undefined") return {};
  return Object.fromEntries(
    document.cookie.split(";").flatMap((part) => {
      const idx = part.indexOf("=");
      if (idx === -1) return [];
      const key = part.slice(0, idx).trim();
      const val = part.slice(idx + 1).trim();
      return [[key, val]];
    })
  );
}

export function getConsent(): ConsentState {
  const cookies = parseCookies();
  const raw = cookies[COOKIE_NAME];
  if (raw !== "accepted" && raw !== "rejected") return "undecided";

  const tsRaw = cookies[COOKIE_TS_NAME];
  if (!tsRaw) return "undecided";

  const ts = parseInt(tsRaw, 10);
  if (!Number.isFinite(ts)) return "undecided";

  const ageS = Math.floor(Date.now() / 1000) - ts;
  if (ageS > LIFETIME_S) return "undecided";

  return raw;
}

export function setConsent(choice: ConsentChoice): { ok: boolean } {
  if (typeof document === "undefined") return { ok: false };

  // Probe: check if document.cookie writes are blocked at all
  const PROBE = "__hs_probe__";
  document.cookie = `${PROBE}=1; Path=/`;
  const probeOk = parseCookies()[PROBE] === "1";
  // Clean up probe
  document.cookie = `${PROBE}=; Max-Age=0; Path=/`;
  if (!probeOk) return { ok: false };

  const nowS = Math.floor(Date.now() / 1000);
  const attrs = `; Max-Age=${LIFETIME_S}; SameSite=Lax; Secure; Path=/`;

  document.cookie = `${COOKIE_NAME}=${choice}${attrs}`;
  document.cookie = `${COOKIE_TS_NAME}=${nowS}${attrs}`;

  return { ok: true };
}

// Ad allow-list: /, /articles, /articles/[slug]
const AD_EXACT = new Set(["/", "/articles"]);
const AD_PREFIX = ["/articles/"];

// Analytics allow-list: above + /documents, /documents/[slug], /videos, /videos/[slug]
const ANALYTICS_EXACT = new Set(["/", "/articles", "/documents", "/videos"]);
const ANALYTICS_PREFIX = ["/articles/", "/documents/", "/videos/"];

// Paths that never get third-party scripts regardless of consent
const BLOCKED_PREFIX = ["/admin", "/checkout", "/account", "/login", "/signup", "/reset-password", "/verify", "/cart", "/download", "/profile", "/purchases"];

function isBlocked(path: string): boolean {
  return BLOCKED_PREFIX.some((p) => path === p || path.startsWith(p + "/") || path.startsWith(p + "?"));
}

export function isAdAllowed(path: string): boolean {
  if (getConsent() !== "accepted") return false;
  if (isBlocked(path)) return false;
  if (AD_EXACT.has(path)) return true;
  return AD_PREFIX.some((p) => path.startsWith(p));
}

export function isAnalyticsAllowed(path: string): boolean {
  if (getConsent() !== "accepted") return false;
  if (isBlocked(path)) return false;
  if (ANALYTICS_EXACT.has(path)) return true;
  return ANALYTICS_PREFIX.some((p) => path.startsWith(p));
}
