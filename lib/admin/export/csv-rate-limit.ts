import "server-only";
import { upstashConfig } from "@/lib/config.upstash";
import { Redis } from "@upstash/redis";

// 3 exports per calendar day (Asia/Colombo), per admin user.
const MAX_EXPORTS_PER_DAY = 3;

let _redis: Redis | null = null;

function getRedis(): Redis {
  const cfg = upstashConfig();
  if (!cfg) throw new Error("Upstash Redis not configured");
  if (!_redis) _redis = new Redis({ url: cfg.url, token: cfg.token });
  return _redis;
}

// Returns seconds until midnight Asia/Colombo (+05:30).
function secondsUntilMidnightColombo(): number {
  const now = new Date();
  // Asia/Colombo is UTC+5:30 — no DST.
  const offsetMs = 5.5 * 60 * 60 * 1000;
  const colomboNow = new Date(now.getTime() + offsetMs);
  const midnight = new Date(colomboNow);
  midnight.setUTCHours(24, 0, 0, 0);
  return Math.ceil((midnight.getTime() - colomboNow.getTime()) / 1000);
}

// In-memory fallback keyed by adminId — only used in dev/test (Upstash absent).
// WARNING: per-process, not shared across serverless instances.
// Stores { count, resetsAt (epoch ms) }.
const _mem = new Map<string, { count: number; resetsAt: number }>();

export interface ExportRateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export async function checkExportRateLimit(adminId: string): Promise<ExportRateLimitResult> {
  const cfg = upstashConfig();
  const retryAfterSeconds = secondsUntilMidnightColombo();

  if (!cfg) {
    // In-memory fallback: used in dev/test environments.
    const now = Date.now();
    const entry = _mem.get(adminId);
    if (!entry || entry.resetsAt <= now) {
      _mem.set(adminId, { count: 1, resetsAt: now + retryAfterSeconds * 1000 });
      return { allowed: true, retryAfterSeconds: 0 };
    }
    if (entry.count >= MAX_EXPORTS_PER_DAY) {
      return { allowed: false, retryAfterSeconds };
    }
    entry.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
  }

  let count: number;
  try {
    const redis = getRedis();
    const key = `export:orders:${adminId}`;
    count = await redis.incr(key);
    // NX: set TTL only if the key has no expiry yet.
    // - On the first call (count === 1) this always fires and pins the expiry.
    // - On calls 2 and 3 the NX is a no-op, so the expiry never drifts.
    // - If a prior call crashed after INCR but before this line, the key has
    //   no TTL; NX will set it on the next call, self-healing the gap.
    // expire is in a separate try so a failure here does not swallow the count.
    try {
      await (redis.expire as (key: string, seconds: number, option: string) => Promise<0 | 1>)(
        key, retryAfterSeconds, "NX",
      );
    } catch {
      // Best-effort fallback: set TTL without NX so the key eventually expires
      // even if the NX call failed (prevents a permanent no-TTL counter).
      redis.expire(key, retryAfterSeconds).catch(() => undefined);
    }
  } catch {
    // Fail open — do not block exports when Redis is unavailable.
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (count > MAX_EXPORTS_PER_DAY) {
    return { allowed: false, retryAfterSeconds };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}
