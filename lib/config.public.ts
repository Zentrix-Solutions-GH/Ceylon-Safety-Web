// Browser-safe subset of config — no server-only import.
// Server components and actions import from lib/config.ts instead.
//
// IMPORTANT: Next.js only inlines NEXT_PUBLIC_ vars when accessed with a
// static key (process.env.NEXT_PUBLIC_FOO). Dynamic access (process.env[name])
// is never replaced by the webpack plugin, so each var must be read directly.

function requiredString(name: string, val: string | undefined): string {
  if (!val || !val.trim()) {
    throw new Error(
      `[config] Missing or empty required environment variable: ${name}`
    );
  }
  return val.trim();
}

function requiredUrl(name: string, val: string | undefined): string {
  const v = requiredString(name, val);
  try {
    new URL(v);
  } catch {
    throw new Error(`[config] Environment variable ${name} must be a valid URL`);
  }
  return v;
}

export const publicConfig = {
  supabaseUrl: requiredUrl("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: requiredString("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  appUrl: requiredUrl("NEXT_PUBLIC_APP_URL", process.env.NEXT_PUBLIC_APP_URL),
  // Cloudflare Turnstile public site key (safe to expose in browser).
  // For local development use the always-passing test key: 1x00000000000000000000AA
  turnstileSiteKey: requiredString("NEXT_PUBLIC_TURNSTILE_SITE_KEY", process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY),
} as const;
