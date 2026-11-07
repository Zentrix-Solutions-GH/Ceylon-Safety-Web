// YouTube ID validation — content system design section 20.
// Strict 11-character alphanumeric+hyphen+underscore check, applied on save (S-048) and at render time.

const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/;

export function isValidYouTubeId(id: string): boolean {
  return YOUTUBE_ID_RE.test(id);
}
