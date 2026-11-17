import "server-only";
import { Redis } from "@upstash/redis";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { upstashConfig } from "@/lib/config.upstash";
import type { Json } from "@/types/database";
import type { AuditEvent, AuditEventName } from "@/types/audit";

// ---------------------------------------------------------------------------
// Shared Upstash Redis client for deduplication.
// Production: SET NX persists dedup across serverless instances.
// Dev/test: in-memory fallback when upstashConfig() returns null.
// ---------------------------------------------------------------------------

const _auditConfig = upstashConfig();
let _auditRedis: Redis | null = null;
function getAuditRedis(): Redis {
  if (!_auditRedis && _auditConfig)
    _auditRedis = new Redis({ url: _auditConfig.url, token: _auditConfig.token });
  if (!_auditRedis) throw new Error("Upstash Redis not configured");
  return _auditRedis;
}

// ---------------------------------------------------------------------------
// Sensitive-value masking
// Digit runs of 8+ characters (bank account numbers, card numbers) are replaced
// with "***" before any value is written to the audit log.
// ---------------------------------------------------------------------------

function maskValue(val: unknown): unknown {
  if (typeof val === "string") {
    return val.replace(/\b\d{8,}\b/g, "***");
  }
  if (Array.isArray(val)) {
    return val.map(maskValue);
  }
  if (val !== null && typeof val === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      out[k] = maskValue(v);
    }
    return out;
  }
  return val;
}

// ---------------------------------------------------------------------------
// Core write — inserts exactly one row. Throws on failure (EC1: silent success
// on a failed audit insert is a security regression — the caller must know).
// ---------------------------------------------------------------------------

export async function writeAuditRow(event: AuditEvent): Promise<void> {
  const { action, actorId = null, entityType, entityId, before, after, summary } = event;

  const maskedBefore = before !== undefined
    ? (maskValue(before) as Record<string, unknown>)
    : undefined;

  const afterWithSummary: Record<string, unknown> | undefined =
    after !== undefined || summary !== undefined
      ? {
          ...(after !== undefined ? (maskValue(after) as Record<string, unknown>) : {}),
          ...(summary !== undefined ? { _summary: summary } : {}),
        }
      : undefined;

  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase.from("admin_audit_log").insert({
    actor_id: (actorId ?? null) as unknown as string,
    action: action as string,
    entity_type: entityType,
    entity_id: entityId,
    before: maskedBefore as Json | null,
    after: afterWithSummary as Json | null,
  });

  if (error) {
    throw new Error(`audit write failed [${action}]: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Session-start guard — writes admin.session_start at most once per
// actor+session. Production: Upstash SET NX key with 12-hour TTL (survives
// across serverless instances). Dev/test: in-memory Set fallback.
// ---------------------------------------------------------------------------

// In-memory fallback (dev/test, Upstash absent).
const _sessionStarted = new Set<string>();

// Mutex-by-key to handle concurrent calls within one instance (EC2: two tabs).
const _sessionLocks = new Map<string, Promise<void>>();

export async function writeSessionStart(
  actorId: string,
  sessionId: string
): Promise<void> {
  const key = `${actorId}:${sessionId}`;

  // If a write for this key is already in progress on this instance, wait.
  const inflight = _sessionLocks.get(key);
  if (inflight) {
    await inflight;
    return;
  }

  // Fast path: already recorded on this instance.
  if (!_auditConfig && _sessionStarted.has(key)) return;

  let resolve!: () => void;
  let reject!: (err: unknown) => void;
  // Waiters await this lock. It resolves on success and REJECTS on failure so
  // concurrent waiters do not silently return when the first writer threw.
  // The no-op .catch suppresses unhandled-rejection warnings when no waiter exists.
  const lock = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
  lock.catch(() => {});
  _sessionLocks.set(key, lock);

  try {
    if (_auditConfig) {
      // Upstash SET NX — atomic across all instances; 12-hour TTL.
      const redisKey = `admin-session-start:${actorId}:${sessionId}`;
      const nx = await getAuditRedis().set(redisKey, "1", { nx: true, ex: 43200 });
      if (nx === null) { resolve(); return; } // Another instance already wrote it.
      // Write audit row AFTER acquiring the NX key. On insert failure, roll back
      // the NX key so a future retry can attempt the insert again.
      try {
        await writeAuditRow({ action: "admin.session_start" as AuditEventName, actorId });
      } catch (err) {
        await getAuditRedis().del(redisKey).catch(() => {});
        throw err;
      }
    } else {
      // In-memory double-check after acquiring the lock.
      if (_sessionStarted.has(key)) { resolve(); return; }
      // Write BEFORE marking done so a retry is possible if writeAuditRow throws.
      await writeAuditRow({ action: "admin.session_start" as AuditEventName, actorId });
      _sessionStarted.add(key);
    }
    resolve();
  } catch (err) {
    reject(err);
    throw err;
  } finally {
    _sessionLocks.delete(key);
  }
}

// ---------------------------------------------------------------------------
// Support-read guard — writes support.read at most once per actor+session+item.
// Production: Upstash SET NX with 24-hour TTL.
// Dev/test: in-memory Set fallback with mutex (matches writeSessionStart).
// ---------------------------------------------------------------------------

const _supportRead = new Set<string>();
const _supportLocks = new Map<string, Promise<void>>();

export async function writeSupportRead(
  actorId: string,
  sessionId: string,
  entityType: string,
  entityId: string
): Promise<void> {
  const key = `${actorId}:${sessionId}:${entityType}:${entityId}`;

  const inflight = _supportLocks.get(key);
  if (inflight) {
    await inflight;
    return;
  }

  if (!_auditConfig && _supportRead.has(key)) return;

  let resolve!: () => void;
  let reject!: (err: unknown) => void;
  const lock = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
  lock.catch(() => {});
  _supportLocks.set(key, lock);

  try {
    if (_auditConfig) {
      const redisKey = `support-read:${actorId}:${sessionId}:${entityType}:${entityId}`;
      const nx = await getAuditRedis().set(redisKey, "1", { nx: true, ex: 86400 });
      if (nx === null) { resolve(); return; }
      try {
        await writeAuditRow({ action: "support.read" as AuditEventName, actorId, entityType, entityId });
      } catch (err) {
        await getAuditRedis().del(redisKey).catch(() => {});
        throw err;
      }
    } else {
      if (_supportRead.has(key)) { resolve(); return; }
      await writeAuditRow({ action: "support.read" as AuditEventName, actorId, entityType, entityId });
      _supportRead.add(key);
    }
    resolve();
  } catch (err) {
    reject(err);
    throw err;
  } finally {
    _supportLocks.delete(key);
  }
}

// ---------------------------------------------------------------------------
// Permission-denied — always written, never deduplicated.
// ---------------------------------------------------------------------------

export async function writeDenied(
  actorId: string,
  entityType: string,
  entityId: string
): Promise<void> {
  await writeAuditRow({
    action: "permission.denied" as AuditEventName,
    actorId,
    entityType,
    entityId,
  });
}
