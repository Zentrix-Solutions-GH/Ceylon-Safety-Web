/**
 * safeNext — return a URL only if it is a relative path on this site.
 * Returns the URL-normalized path+search (so /../admin → /admin).
 * Any absolute URL, protocol-relative URL, backslash trick, null byte,
 * javascript: scheme, non-string input, or very long string returns "/".
 * Auth design §9, AC9.
 */
export function safeNext(url: unknown): string {
  if (typeof url !== "string" || url === "") return "/";

  // Reject null bytes early
  if (url.includes("\0")) return "/";

  // Must start with a single slash (not // which is protocol-relative)
  if (!url.startsWith("/") || url.startsWith("//")) return "/";

  // Reject backslash after leading slash (open-redirect trick: /\evil.com)
  if (url.startsWith("/\\")) return "/";

  // Reject very long strings (guard against log exhaustion)
  if (url.length > 2048) return "/";

  // Parse to normalize and detect any escape attempts
  try {
    const parsed = new URL(url, "https://placeholder.invalid");
    // The parsed href must stay on the placeholder origin
    if (parsed.origin !== "https://placeholder.invalid") return "/";
    // Return the normalized pathname + query string only
    return parsed.pathname + (parsed.search ?? "");
  } catch {
    return "/";
  }
}
