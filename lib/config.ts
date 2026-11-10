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
  ["NEXT_PUBLIC_APP_URL", url],
  ["SUPABASE_SERVICE_ROLE_KEY", string],
  ["NEXT_SERVER_ACTIONS_ENCRYPTION_KEY", hex64],
  ["CRON_SECRET", string],
  ["RESEND_API_KEY", string],
  ["EMAIL_FROM", string],
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
  appUrl: vals["NEXT_PUBLIC_APP_URL"],
} as const;

// Server-only secrets — protected by server-only import above
export const serverConfig = {
  supabaseServiceRoleKey: vals["SUPABASE_SERVICE_ROLE_KEY"],
  encryptionKey: vals["NEXT_SERVER_ACTIONS_ENCRYPTION_KEY"],
  cronSecret: vals["CRON_SECRET"],
  resendApiKey: vals["RESEND_API_KEY"],
  emailFrom: vals["EMAIL_FROM"],
  videoPlaceholderKey: optional("VIDEO_PLACEHOLDER_KEY", "placeholders/video.jpg"),
  feedRateLimitPerMinute: parseInt(optional("FEED_RATE_LIMIT_PER_MINUTE", "60"), 10),
  countersRateLimitPerMinute: parseInt(optional("COUNTERS_RATE_LIMIT_PER_MINUTE", "60"), 10),
} as const;

// Healthchecks config — optional; returns null when env vars are absent so the
// caller skips the ping silently outside production.
export function healthchecksConfig(
  job: string
): { baseUrl: string; checkId: string } | null {
  const baseUrl = process.env["HEALTHCHECKS_BASE_URL"]?.trim();
  const idKey = `HEALTHCHECKS_${job.toUpperCase().replace(/-/g, "_")}_ID`;
  const checkId = process.env[idKey]?.trim();
  if (!baseUrl || !checkId) return null;
  return { baseUrl, checkId };
}

// CSP config — used in tests only. Production code (lib/security/headers.ts)
// reads env vars directly to avoid importing server-only through next.config.ts.
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

// R2 config — server only; returns null when env vars absent (tests inject mocks via vi.mock).
export function r2Config(): {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketPublic: string;
  bucketPrivate: string;
  publicMediaBaseUrl: string;
} | null {
  const accountId = process.env["R2_ACCOUNT_ID"]?.trim();
  const accessKeyId = process.env["R2_ACCESS_KEY_ID"]?.trim();
  const secretAccessKey = process.env["R2_SECRET_ACCESS_KEY"]?.trim();
  const bucketPublic = process.env["R2_BUCKET_PUBLIC"]?.trim();
  const bucketPrivate = process.env["R2_BUCKET_PRIVATE"]?.trim();
  const publicMediaBaseUrl = process.env["NEXT_PUBLIC_PUBLIC_MEDIA_BASE_URL"]?.trim();
  if (!accountId || !accessKeyId || !secretAccessKey || !bucketPublic || !bucketPrivate || !publicMediaBaseUrl) {
    return null;
  }
  return { accountId, accessKeyId, secretAccessKey, bucketPublic, bucketPrivate, publicMediaBaseUrl };
}

// File size limits for document uploads (S-070).
export const PPTX_MAX_BYTES = 100 * 1024 * 1024; // 100 MB
export const PREVIEW_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

// Fail fast when R2 is not configured (CLAUDE.md: missing config → startup error).
// Skip during `next build` — Next.js sets NODE_ENV=production at build time but
// R2 vars are only available at runtime, so NEXT_PHASE guards the build phase.
if (
  process.env.NODE_ENV === "production" &&
  process.env.NEXT_PHASE !== "phase-production-build" &&
  !r2Config()
) {
  throw new Error(
    "[config] Missing required R2 environment variables: " +
      "R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, " +
      "R2_BUCKET_PUBLIC, R2_BUCKET_PRIVATE, NEXT_PUBLIC_PUBLIC_MEDIA_BASE_URL"
  );
}
