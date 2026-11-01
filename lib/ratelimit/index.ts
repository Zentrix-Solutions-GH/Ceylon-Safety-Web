import "server-only";

// Rate-limit module (S-007) — Upstash Redis REST API via @upstash/redis.
//
// Limit table (authentication design section 15) — calling actions copy these numbers:
//   sign-up          5 / hour / IP (open)
//   sign-in          5 / 15 min / email+IP composite (closed)
//   email code send  5 / hour / email (closed); 1 / 60 s / email (closed)
//   wrong code       5 attempts / code / email (closed)
//   password reset   3 / hour / email (closed); 10 / hour / IP (closed)
//   search           30 / min / IP (open); global cap TBD
//   download req     10 / hour / user (closed) — Q77, to confirm
//   comment submit   10 / hour / user, 5 pending cap (DB trigger, not this lib)
//   banner click     5 / min / addr / banner, 30 / min / addr (Release 2)
//
// Composite keys (e.g. sign-in "email:ip") are built by the caller before passing to this lib.
// The lib hashes whatever string it receives once; it does not double-hash.
// Key rotation (hashing secret changes): all counters reset — accepted per infra design 10.

import { Redis } from "@upstash/redis";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RateLimitMode = "open" | "closed";

export type OutageContext = {
  limitName: string;
  mode: RateLimitMode;
  error: unknown;
};

export type RateLimitOptions = {
  limitName: string;
  key: string;
  maxCount: number;
  windowSeconds: number;
  mode: RateLimitMode;
  onOutage?: (ctx: OutageContext) => void;
};

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSeconds?: number; reason: "rate_limited" | "unavailable" };

// ---------------------------------------------------------------------------
// Config and env helpers
// ---------------------------------------------------------------------------

const _envPrefix = process.env["NODE_ENV"] === "production" ? "prod" : "stg";

function requireUpstashConfig(): { url: string; token: string; hashSecret: string } | null {
  const url = process.env["UPSTASH_REDIS_REST_URL"]?.trim();
  const token = process.env["UPSTASH_REDIS_REST_TOKEN"]?.trim();
  const hashSecret = process.env["RATELIMIT_HASH_SECRET"]?.trim();

  if (process.env["NODE_ENV"] === "production") {
    if (!url) throw new Error("[config] Missing required env var: UPSTASH_REDIS_REST_URL");
    if (!token) throw new Error("[config] Missing required env var: UPSTASH_REDIS_REST_TOKEN");
    if (!hashSecret) throw new Error("[config] Missing required env var: RATELIMIT_HASH_SECRET");
    return { url, token, hashSecret };
  }

  if (url && token && hashSecret) return { url, token, hashSecret };
  return null; // use in-memory fallback
}

// ---------------------------------------------------------------------------
// HMAC-SHA256 key hashing — email and IP never stored in clear
// ---------------------------------------------------------------------------

async function hashKey(secret: string, limitName: string, rawKey: string): Promise<string> {
  const normalised = rawKey.trim().toLowerCase();
  const input = `${_envPrefix}:${limitName}:${normalised}`;
  const keyData = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", keyData, new TextEncoder().encode(input));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${_envPrefix}:${hex}`;
}

// ---------------------------------------------------------------------------
// Upstash fixed-window limiter
// ---------------------------------------------------------------------------

let _redis: Redis | null = null;

function getRedis(url: string, token: string): Redis {
  if (!_redis) _redis = new Redis({ url, token });
  return _redis;
}

const TIMEOUT_MS = 500;

function makeTimeout(): Promise<never> {
  return new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("upstash_timeout")), TIMEOUT_MS)
  );
}

async function checkUpstash(
  redis: Redis,
  hashedKey: string,
  maxCount: number,
  windowSeconds: number
): Promise<{ count: number }> {
  // INCR first — returns current count atomically
  const incrPipe = redis.pipeline();
  incrPipe.incr(hashedKey);
  const [count] = (await Promise.race([incrPipe.exec(), makeTimeout()])) as [number];

  // Set TTL only when the key is newly created (count === 1) — fixed-window semantics.
  // Calling EXPIRE on every request would reset the window on each hit (sliding window).
  if (count === 1) {
    const expPipe = redis.pipeline();
    expPipe.expire(hashedKey, windowSeconds);
    await Promise.race([expPipe.exec(), makeTimeout()]);
  }

  return { count };
}

// ---------------------------------------------------------------------------
// In-memory fallback (non-production, Upstash absent)
// ---------------------------------------------------------------------------

type MemWindow = { count: number; expiresAt: number };
const _memStore = new Map<string, MemWindow>();

async function digestKey(key: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function checkMemory(key: string, maxCount: number, windowSeconds: number): RateLimitResult {
  const now = Date.now();
  let win = _memStore.get(key);
  if (!win || win.expiresAt <= now) {
    win = { count: 0, expiresAt: now + windowSeconds * 1000 };
    _memStore.set(key, win);
  }
  win.count += 1;
  if (win.count > maxCount) {
    const retryAfterSeconds = Math.ceil((win.expiresAt - now) / 1000);
    return { ok: false, retryAfterSeconds, reason: "rate_limited" };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const _config = requireUpstashConfig();

export async function checkRateLimit(opts: RateLimitOptions): Promise<RateLimitResult> {
  const { limitName, key, maxCount, windowSeconds, mode, onOutage } = opts;

  // In-memory path (non-production, no Upstash config)
  if (!_config) {
    const memKey = await digestKey(`${limitName}:${key.trim().toLowerCase()}`);
    return checkMemory(memKey, maxCount, windowSeconds);
  }

  const hashedKey = await hashKey(_config.hashSecret, limitName, key);

  try {
    const redis = getRedis(_config.url, _config.token);
    const { count } = await checkUpstash(redis, hashedKey, maxCount, windowSeconds);

    if (count > maxCount) {
      // Approximation: window is always windowSeconds from first request in this window
      return { ok: false, retryAfterSeconds: windowSeconds, reason: "rate_limited" };
    }
    return { ok: true };
  } catch (error) {
    onOutage?.({ limitName, mode, error });

    if (mode === "open") return { ok: true };
    return { ok: false, reason: "unavailable" };
  }
}
