import "server-only";
// Wrong-attempt counter for verifyEmail (AC4).
// Stored in Upstash via checkRateLimit; key is the email hash.
// Window matches the OTP lifetime (1 hour) — after which Supabase expires the code anyway.

import { upstashConfig } from "@/lib/config.upstash";
import { Redis } from "@upstash/redis";

const WINDOW_SECONDS = 3600; // 1 hour — matches OTP lifetime
const KEY_PREFIX = "attempts:email:";

// In-memory fallback for non-production (mirrors the pattern in lib/ratelimit)
const _mem = new Map<string, { count: number; expiresAt: number }>();

let _redis: Redis | null = null;

function getRedis(url: string, token: string): Redis {
  if (!_redis) _redis = new Redis({ url, token });
  return _redis;
}

function memKey(email: string): string {
  return `${KEY_PREFIX}${email.trim().toLowerCase()}`;
}

async function redisKey(email: string, hashSecret: string): Promise<string> {
  const normalised = email.trim().toLowerCase();
  const input = `attempts:${normalised}`;
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

export async function getAttempts(email: string): Promise<number> {
  const cfg = upstashConfig();
  if (!cfg) {
    const k = memKey(email);
    const w = _mem.get(k);
    if (!w || w.expiresAt <= Date.now()) return 0;
    return w.count;
  }
  try {
    const redis = getRedis(cfg.url, cfg.token);
    const key = await redisKey(email, cfg.hashSecret);
    const val = await redis.get<number>(key);
    return val ?? 0;
  } catch {
    return 0; // fail open — don't block verify on counter read failure
  }
}

export async function incAttempts(email: string): Promise<number> {
  const cfg = upstashConfig();
  if (!cfg) {
    const k = memKey(email);
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
    const key = await redisKey(email, cfg.hashSecret);
    const pipe = redis.pipeline();
    pipe.incr(key);
    pipe.expire(key, WINDOW_SECONDS);
    const [count] = (await pipe.exec()) as [number, number];
    return count;
  } catch {
    return 0; // fail open
  }
}

export async function resetAttempts(email: string): Promise<void> {
  const cfg = upstashConfig();
  if (!cfg) {
    _mem.delete(memKey(email));
    return;
  }
  try {
    const redis = getRedis(cfg.url, cfg.token);
    const key = await redisKey(email, cfg.hashSecret);
    await redis.del(key);
  } catch {
    // fail open — a stuck counter is handled by the 1-hour TTL
  }
}
