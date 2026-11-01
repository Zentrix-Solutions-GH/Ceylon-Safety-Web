import "server-only";

// Upstash / rate-limit configuration (AC4, S-007).
// Optional in non-production (triggers in-memory fallback in lib/ratelimit/).
// Required in production — missing vars throw at startup so the process never
// serves traffic with no rate-limit backend.

export type UpstashConfig = {
  url: string;
  token: string;
  hashSecret: string;
};

export function upstashConfig(): UpstashConfig | null {
  const upstashUrl = process.env["UPSTASH_REDIS_REST_URL"]?.trim();
  const token = process.env["UPSTASH_REDIS_REST_TOKEN"]?.trim();
  const hashSecret = process.env["RATELIMIT_HASH_SECRET"]?.trim();

  if (process.env["NODE_ENV"] === "production") {
    if (!upstashUrl)
      throw new Error("[config] Missing required env var: UPSTASH_REDIS_REST_URL");
    if (!token)
      throw new Error("[config] Missing required env var: UPSTASH_REDIS_REST_TOKEN");
    if (!hashSecret)
      throw new Error("[config] Missing required env var: RATELIMIT_HASH_SECRET");
    return { url: upstashUrl, token, hashSecret };
  }

  if (upstashUrl && token && hashSecret) return { url: upstashUrl, token, hashSecret };
  return null; // use in-memory fallback
}
