import "server-only";

// Public values are also re-exported from lib/config.public.ts (no server-only)
// for use in browser/client code. Import from there in client components.

type Validator = (name: string) => string;

function collect(validators: Array<[string, Validator]>): Record<string, string> {
  const errors: string[] = [];
  const values: Record<string, string> = {};

  for (const [name, validate] of validators) {
    try {
      values[name] = validate(name);
    } catch {
      errors.push(name);
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `[config] Missing or invalid environment variables: ${errors.join(", ")}`
    );
  }

  return values;
}

function string(name: string): string {
  const val = process.env[name];
  if (!val || !val.trim()) throw new Error();
  return val.trim();
}

function url(name: string): string {
  const val = string(name);
  try { new URL(val); } catch { throw new Error(); }
  return val;
}

function hex64(name: string): string {
  const val = string(name);
  if (!/^[0-9a-f]{64}$/i.test(val)) throw new Error();
  return val;
}

function optional(name: string, defaultVal: string): string {
  return process.env[name]?.trim() || defaultVal;
}

const vals = collect([
  ["NEXT_PUBLIC_SUPABASE_URL", url],
  ["NEXT_PUBLIC_SUPABASE_ANON_KEY", string],
  ["SUPABASE_SERVICE_ROLE_KEY", string],
  ["NEXT_SERVER_ACTIONS_ENCRYPTION_KEY", hex64],
]);

// CSP config — validated separately so errors are specific
const cspModeRaw = (() => {
  const v = process.env["CSP_MODE"]?.trim();
  if (!v) throw new Error("[config] Missing required env var: CSP_MODE");
  if (v !== "report-only" && v !== "enforce")
    throw new Error(`[config] CSP_MODE must be "report-only" or "enforce", got: ${v}`);
  return v as "report-only" | "enforce";
})();

// Public values — safe for the browser; baked in at build time via NEXT_PUBLIC_*
export const publicConfig = {
  supabaseUrl: vals["NEXT_PUBLIC_SUPABASE_URL"],
  supabaseAnonKey: vals["NEXT_PUBLIC_SUPABASE_ANON_KEY"],
} as const;

// Server-only secrets — protected by server-only import above
export const serverConfig = {
  supabaseServiceRoleKey: vals["SUPABASE_SERVICE_ROLE_KEY"],
  encryptionKey: vals["NEXT_SERVER_ACTIONS_ENCRYPTION_KEY"],
} as const;

// CSP config — used by lib/security/headers.ts and next.config.ts
export const cspConfig = {
  mode: cspModeRaw,
  // Image CDN base URL — needed for img-src directive
  imageCdnUrl: url("NEXT_PUBLIC_PUBLIC_MEDIA_BASE_URL"),
  // PayHere sandbox flag — determines form-action host on /checkout
  payhereIsSandbox: process.env["NEXT_PUBLIC_PAYHERE_SANDBOX"] === "true",
  // Well-known stable CDN hosts; override via env var if they ever change
  youtubeNocookieHost: optional(
    "NEXT_PUBLIC_CSP_YOUTUBE_HOST",
    "https://www.youtube-nocookie.com"
  ),
  googleAvatarHost: optional(
    "NEXT_PUBLIC_CSP_GOOGLE_AVATAR_HOST",
    "lh3.googleusercontent.com"
  ),
  turnstileHost: optional(
    "NEXT_PUBLIC_CSP_TURNSTILE_HOST",
    "challenges.cloudflare.com"
  ),
} as const;
