// headers.ts reads env vars directly so next.config.ts can import it without
// pulling in lib/config.ts (which has `import "server-only"` — unavailable in
// the jiti context used to load next.config.ts).

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`[headers] Missing required env var: ${name}`);
  return v;
}

function optionalEnv(name: string, defaultVal: string): string {
  return process.env[name]?.trim() || defaultVal;
}

function cspMode(): "report-only" | "enforce" {
  const v = requireEnv("CSP_MODE");
  if (v !== "report-only" && v !== "enforce")
    throw new Error(`[headers] CSP_MODE must be "report-only" or "enforce", got: ${v}`);
  return v;
}

// Routes that carry the Turnstile widget
const TURNSTILE_PATHS = new Set([
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
]);

// Private route prefixes that get no-store + noindex + referrer policy
const PRIVATE_PREFIXES = [
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/suspended",
  "/admin",
  "/cart",
  "/checkout",
  "/download",
  "/purchases",
  "/profile",
  "/api",
];

function payhereHost(): string {
  return process.env["NEXT_PUBLIC_PAYHERE_SANDBOX"] === "true"
    ? "sandbox.payhere.lk"
    : "www.payhere.lk";
}

function isPrivate(path: string): boolean {
  return PRIVATE_PREFIXES.some(
    (p) => path === p || path.startsWith(p + "/") || path.startsWith(p + "?")
  );
}

function hasTurnstile(path: string): boolean {
  return TURNSTILE_PATHS.has(path);
}

export function buildPublicCsp(): string {
  const imageCdn = requireEnv("NEXT_PUBLIC_PUBLIC_MEDIA_BASE_URL");
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const youtubeNocookieHost = optionalEnv("NEXT_PUBLIC_CSP_YOUTUBE_HOST", "https://www.youtube-nocookie.com");
  const googleAvatarHost = optionalEnv("NEXT_PUBLIC_CSP_GOOGLE_AVATAR_HOST", "lh3.googleusercontent.com");
  const turnstileHost = optionalEnv("NEXT_PUBLIC_CSP_TURNSTILE_HOST", "challenges.cloudflare.com");

  const directives: string[] = [
    `default-src 'self'`,
    `script-src 'self' ${turnstileHost}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' ${imageCdn} ${googleAvatarHost}`,
    `font-src 'self'`,
    `connect-src 'self' ${supabaseUrl} ${turnstileHost}`,
    // Turnstile renders its challenge inside a sandboxed iframe
    `frame-src ${youtubeNocookieHost} ${turnstileHost}`,
    `frame-ancestors 'none'`,
    `form-action 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
  ];

  return directives.join("; ");
}

export function buildPrivateCsp(path: string): string {
  const imageCdn = requireEnv("NEXT_PUBLIC_PUBLIC_MEDIA_BASE_URL");
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const googleAvatarHost = optionalEnv("NEXT_PUBLIC_CSP_GOOGLE_AVATAR_HOST", "lh3.googleusercontent.com");
  const turnstileHost = optionalEnv("NEXT_PUBLIC_CSP_TURNSTILE_HOST", "challenges.cloudflare.com");

  const imgSrcExtras = path === "/admin/security" ? " data:" : "";

  const scriptExtras = hasTurnstile(path) ? ` ${turnstileHost}` : "";
  const connectExtras = hasTurnstile(path) ? ` ${turnstileHost}` : "";
  // Turnstile renders its challenge in a sandboxed iframe on widget pages
  const frameSrc = hasTurnstile(path) ? `frame-src ${turnstileHost}` : `frame-src 'none'`;
  const formAction =
    path === "/checkout" || path.startsWith("/checkout/")
      ? `form-action 'self' https://${payhereHost()}`
      : `form-action 'self'`;

  const directives: string[] = [
    `default-src 'self'`,
    `script-src 'self'${scriptExtras}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' ${imageCdn} ${googleAvatarHost}${imgSrcExtras}`,
    `font-src 'self'`,
    `connect-src 'self' ${supabaseUrl}${connectExtras}`,
    frameSrc,
    `frame-ancestors 'none'`,
    formAction,
    `base-uri 'self'`,
    `object-src 'none'`,
  ];

  return directives.join("; ");
}

export function cspHeaderName(): string {
  return cspMode() === "report-only"
    ? "Content-Security-Policy-Report-Only"
    : "Content-Security-Policy";
}

export interface NextHeader {
  key: string;
  value: string;
}

export function buildStaticHeaders(path: string): NextHeader[] {
  if (!isPrivate(path)) return [];

  return [
    { key: "Cache-Control", value: "no-store" },
    { key: "X-Robots-Tag", value: "noindex, nofollow" },
    { key: "Referrer-Policy", value: "same-origin" },
  ];
}
