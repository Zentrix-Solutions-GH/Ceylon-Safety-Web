import { config } from "@/lib/config";

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
  return config.payhere.sandbox ? "sandbox.payhere.lk" : "www.payhere.lk";
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
  const imageCdn = config.r2.publicMediaBaseUrl;
  const supabaseUrl = config.supabase.url;
  const { youtubeNocookieHost, googleAvatarHost, turnstileHost } = config.csp;

  const directives: string[] = [
    `default-src 'self'`,
    `script-src 'self' ${turnstileHost}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' ${imageCdn} ${googleAvatarHost}`,
    `font-src 'self'`,
    `connect-src 'self' ${supabaseUrl} ${turnstileHost}`,
    `frame-src ${youtubeNocookieHost}`,
    `frame-ancestors 'none'`,
    `form-action 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
  ];

  return directives.join("; ");
}

export function buildPrivateCsp(path: string): string {
  const imageCdn = config.r2.publicMediaBaseUrl;
  const supabaseUrl = config.supabase.url;
  const { googleAvatarHost, turnstileHost } = config.csp;

  const imgSrcExtras = path === "/admin/security" ? " data:" : "";

  const scriptExtras = hasTurnstile(path) ? ` ${turnstileHost}` : "";
  const connectExtras = hasTurnstile(path) ? ` ${turnstileHost}` : "";
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
    `frame-src 'none'`,
    `frame-ancestors 'none'`,
    formAction,
    `base-uri 'self'`,
    `object-src 'none'`,
  ];

  return directives.join("; ");
}

export function cspHeaderName(): string {
  return config.csp.mode === "report-only"
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
