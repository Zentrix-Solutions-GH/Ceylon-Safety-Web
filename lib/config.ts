// All environment variables read here; missing required values fail at startup
function required(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

function optional(name: string, defaultVal: string): string {
  return process.env[name] ?? defaultVal;
}

export const config = {
  supabase: {
    url: required("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    serviceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  },
  r2: {
    accountId: required("R2_ACCOUNT_ID"),
    accessKeyId: required("R2_ACCESS_KEY_ID"),
    secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
    bucketPrivate: required("R2_BUCKET_PRIVATE"),
    bucketPublic: required("R2_BUCKET_PUBLIC"),
    publicMediaBaseUrl: required("NEXT_PUBLIC_PUBLIC_MEDIA_BASE_URL"),
  },
  resend: {
    apiKey: required("RESEND_API_KEY"),
    fromEmail: required("RESEND_FROM_EMAIL"),
  },
  payhere: {
    merchantId: required("PAYHERE_MERCHANT_ID"),
    merchantSecret: required("PAYHERE_MERCHANT_SECRET"),
    sandbox: process.env.NEXT_PUBLIC_PAYHERE_SANDBOX === "true",
  },
  upstash: {
    redisUrl: required("UPSTASH_REDIS_REST_URL"),
    redisToken: required("UPSTASH_REDIS_REST_TOKEN"),
  },
  turnstile: {
    siteKey: required("NEXT_PUBLIC_TURNSTILE_SITE_KEY"),
    secretKey: required("TURNSTILE_SECRET_KEY"),
  },
  cron: { secret: required("CRON_SECRET") },
  app: { url: required("NEXT_PUBLIC_APP_URL") },
  csp: {
    mode: (() => {
      const v = required("CSP_MODE");
      if (v !== "report-only" && v !== "enforce")
        throw new Error(`CSP_MODE must be "report-only" or "enforce", got: ${v}`);
      return v as "report-only" | "enforce";
    })(),
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
  },
} as const;