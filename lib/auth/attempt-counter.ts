import "server-only";
// Wrong-attempt counter for verifyEmail (AC4).
// Stored in Upstash via checkRateLimit; key is the email hash.
// Window matches the OTP lifetime (1 hour) — after which Supabase expires the code anyway.

import { upstashConfig } from "@/lib/config.upstash";
import { Redis } from "@upstash/redis";

const WINDOW_SECONDS = 3600; // 1 hour — matches OTP lifetime

// In-memory fallback for non-production (mirrors the pattern in lib/ratelimit)
const _mem = new Map<string, { count: number; expiresAt: number }>();

let _redis: Redis | null = null;

function getRedis(url: string, token: string): Redis {
  if (!_redis) _redis = new Redis({ url, token });
  return _redis;
}

function memKey(value: string, namespace: string): string {
  return `attempts:${namespace}:${value.trim().toLowerCase()}`;
}

async function redisKey(value: string, namespace: string, hashSecret: string): Promise<string> {
  const normalised = value.trim().toLowerCase();
  // Preserve legacy hash input for "email" namespace to avoid orphaning existing S-034 counters in Redis.
  const input = namespace === "email" ? `attempts:${normalised}` : `attempts:${namespace}:${normalised}`;
  const keyData = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(hashSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", keyData, new TextEncoder().encode(input));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `attempts:${hex}`;
}

/** namespace="email" is the default bucket used by verifyEmail (S-034). */
export async function getAttempts(value: string, namespace = "email"): Promise<number> {
  const cfg = upstashConfig();
  if (!cfg) {
    const k = memKey(value, namespace);
    const w = _mem.get(k);
    if (!w || w.expiresAt <= Date.now()) return 0;
    return w.count;
  }
  try {
    const redis = getRedis(cfg.url, cfg.token);
    const key = await redisKey(value, namespace, cfg.hashSecret);
    const val = await redis.get<number>(key);
    return val ?? 0;
  } catch {
    return 0; // fail open — don't block verify on counter read failure
  }
}

export async function incAttempts(value: string, namespace = "email"): Promise<number> {
  const cfg = upstashConfig();
  if (!cfg) {
    const k = memKey(value, namespace);
    const now = Date.now();
    const w = _mem.get(k);
    if (!w || w.expiresAt <= now) {
      _mem.set(k, { count: 1, expiresAt: now + WINDOW_SECONDS * 1000 });
      return 1;
    }
    w.count += 1;
    return w.count;
  }
  try {
    const redis = getRedis(cfg.url, cfg.token);
    const key = await redisKey(value, namespace, cfg.hashSecret);
    const pipe = redis.pipeline();
    pipe.incr(key);
    pipe.expire(key, WINDOW_SECONDS);
    const [count] = (await pipe.exec()) as [number, number];
    return count;
  } catch {
    return 0; // fail open
  }
}

export async function resetAttempts(value: string, namespace = "email"): Promise<void> {
  const cfg = upstashConfig();
  if (!cfg) {
    _mem.delete(memKey(value, namespace));
    return;
  }
  try {
    const redis = getRedis(cfg.url, cfg.token);
    const key = await redisKey(value, namespace, cfg.hashSecret);
    await redis.del(key);
  } catch {
    // fail open — a stuck counter is handled by the 1-hour TTL
  }
}
