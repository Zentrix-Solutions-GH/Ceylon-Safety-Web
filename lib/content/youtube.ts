/** Exact id format required by DB CHECK and render (AC1). */
export const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/;

/** True when the string is a valid 11-char YouTube video id. */
export function isValidYouTubeId(id: string): boolean {
  return YOUTUBE_ID_RE.test(id);
}

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
]);

/**
 * Extract the YouTube video id from a known link shape.
 * Returns the 11-char id or null for any invalid input.
 * Pure function — safe to call in both server and browser contexts.
 */
export function extractYouTubeId(link: string): string | null {
  if (!link) return null;

  // Reject control characters before URL parsing
  if (/[\x00-\x1f]/.test(link)) return null;

  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();
  if (!YOUTUBE_HOSTS.has(host)) return null;

  // Reject user/channel paths that start with @
  if (url.pathname.startsWith("/@")) return null;

  let id: string | null = null;

  if (host === "youtu.be") {
    // https://youtu.be/<id>
    id = url.pathname.slice(1).split("?")[0].split("/")[0];
  } else if (url.pathname.startsWith("/watch")) {
    // https://www.youtube.com/watch?v=<id>
    id = url.searchParams.get("v");
  } else if (url.pathname.startsWith("/embed/")) {
    // https://www.youtube.com/embed/<id>
    id = url.pathname.slice("/embed/".length).split("?")[0].split("/")[0];
  } else if (url.pathname.startsWith("/shorts/")) {
    // https://www.youtube.com/shorts/<id>
    id = url.pathname.slice("/shorts/".length).split("?")[0].split("/")[0];
  }

  if (!id || !YOUTUBE_ID_RE.test(id)) return null;
  return id;
}
