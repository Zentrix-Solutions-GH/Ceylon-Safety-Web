// Link policy for article bodies — section 6.1 of the content system design.
// Allowed: https and http only. Everything else is refused.

const CONTROL_OR_HIDDEN = /[\x00-\x1f\x7f​‌‍⁠﻿]/;
const MAX_URL_LENGTH = 2048;

type LinkResult =
  | { ok: true }
  | { ok: false; message: string };

export function checkLink(raw: string): LinkResult {
  const refuse = (msg: string): LinkResult => ({ ok: false, message: msg });

  if (raw.length > MAX_URL_LENGTH) {
    return refuse(`This link is not allowed: ${raw}`);
  }

  // Strip control/whitespace variants before scheme check to catch java\tscript:
  const stripped = raw.replace(/[\t\n\r ]/g, "");

  // Extract scheme (everything before the first colon)
  const colonIdx = stripped.indexOf(":");
  if (colonIdx === -1) {
    // No scheme — could be a relative path or // address
    return refuse(`This link is not allowed: ${raw}`);
  }
  const scheme = stripped.slice(0, colonIdx).toLowerCase();

  if (scheme !== "https" && scheme !== "http") {
    return refuse(`This link is not allowed: ${raw}`);
  }

  // Parse with URL to catch credential abuse and hidden chars
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return refuse(`This link is not allowed: ${raw}`);
  }

  // Refuse internal paths (no host or empty host)
  if (!parsed.hostname) {
    return refuse(`This link is not allowed: ${raw}`);
  }

  // Refuse credentials in URL (username or password)
  if (parsed.username || parsed.password) {
    return refuse(`This link is not allowed: ${raw}`);
  }

  // Refuse control or hidden Unicode characters in the full URL
  if (CONTROL_OR_HIDDEN.test(raw)) {
    return refuse(`This link is not allowed: ${raw}`);
  }

  return { ok: true };
}

/** Walk the body nodes and check every link mark. Returns the first bad link or null. */
export function findBadLink(nodes: unknown[]): string | null {
  for (const node of nodes) {
    const n = node as Record<string, unknown>;
    if (Array.isArray(n.marks)) {
      for (const m of n.marks as Record<string, unknown>[]) {
        if (m.type === "link") {
          const attrs = m.attrs as Record<string, unknown> | undefined;
          const href = typeof attrs?.href === "string" ? attrs.href : "";
          const result = checkLink(href);
          if (!result.ok) return result.message;
        }
      }
    }
    if (Array.isArray(n.content)) {
      const found = findBadLink(n.content as unknown[]);
      if (found) return found;
    }
  }
  return null;
}
