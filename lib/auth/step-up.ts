import "server-only";
import { Redis } from "@upstash/redis";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { upstashConfig } from "@/lib/config.upstash";

// ---------------------------------------------------------------------------
// Step-up helper — verifies a fresh TOTP code before money actions.
// (Admin panel design section 5, PROPOSED S13, team decision to implement.)
//
// A successful verification is cached per actor for 5 minutes (300 s).
// Production: Upstash Redis key `step-up:{actorId}` with 300 s TTL (survives
// across serverless instances). Dev/test: in-memory Map fallback when Upstash
// is not configured.
// ---------------------------------------------------------------------------

const STEP_UP_TTL_S = 300; // 5 minutes
const STEP_UP_TTL_MS = STEP_UP_TTL_S * 1000;

const _config = upstashConfig();

// In-memory fallback for dev/test (Upstash absent).
type StepUpCache = { expiresAt: number };
const _memCache = new Map<string, StepUpCache>();

let _redis: Redis | null = null;
function getStepUpRedis(): Redis {
  if (!_redis && _config) _redis = new Redis({ url: _config.url, token: _config.token });
  if (!_redis) throw new Error("Upstash Redis not configured");
  return _redis;
}

async function isCacheValid(actorId: string): Promise<boolean> {
  if (_config) {
    const val = await getStepUpRedis().get<string>(`step-up:${actorId}`);
    return val !== null;
  }
  const entry = _memCache.get(actorId);
  return entry !== undefined && Date.now() < entry.expiresAt;
}

async function setCache(actorId: string): Promise<void> {
  if (_config) {
    await getStepUpRedis().set(`step-up:${actorId}`, "1", { ex: STEP_UP_TTL_S });
    return;
  }
  _memCache.set(actorId, { expiresAt: Date.now() + STEP_UP_TTL_MS });
}

/** @internal Reset the in-memory cache between tests. Never call in production. */
export function _resetCacheForTest(): void {
  _memCache.clear();
}

// ---------------------------------------------------------------------------
// verifyStepUp — resolves the enrolled TOTP factor ID, then challenges + verifies.
// Returns ok:true on success, ok:false with mfa_required on wrong/missing code.
// ---------------------------------------------------------------------------

export async function verifyStepUp(
  totpCode: string
): Promise<{ ok: true } | { ok: false; code: "mfa_required" }> {
  const supabase = await createSupabaseServerClient();

  // Resolve the enrolled TOTP factor UUID — "totp" is a factor type, not an ID.
  // Thrown rejections AND return-value errors (JWT expiry, quota) both propagate
  // to the caller rather than being silently converted to mfa_required.
  const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();
  if (factorsError) throw factorsError;
  const totpFactor = factorsData?.totp?.find(
    (f) => f.factor_type === "totp" && f.status === "verified"
  );
  if (!totpFactor) {
    return { ok: false, code: "mfa_required" };
  }

  const { data: challengeData, error: challengeErr } =
    await supabase.auth.mfa.challenge({ factorId: totpFactor.id });

  if (challengeErr || !challengeData) {
    return { ok: false, code: "mfa_required" };
  }

  const { error: verifyErr } = await supabase.auth.mfa.verify({
    factorId: totpFactor.id,
    challengeId: challengeData.id,
    code: totpCode,
  });

  if (verifyErr) {
    return { ok: false, code: "mfa_required" };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// requireStepUp — the public API for money actions.
// Throws { code: "mfa_required" } when the code is absent, wrong, or expired.
// ---------------------------------------------------------------------------

/**
 * Enforce a fresh TOTP step-up before a money action.
 *
 * @param actorId  The authenticated user's ID. **Must** be `session.user.id`
 *   from a verified server-side session — never sourced from request body or
 *   URL params. Passing a different UUID will warm the step-up cache for the
 *   wrong actor and bypass the check.
 * @param totpCode The 6-digit TOTP code from the request, or `undefined` to
 *   rely on the 5-minute cache from a previous successful verification.
 */
export async function requireStepUp(
  actorId: string,
  totpCode: string | undefined
): Promise<void> {
  // Cache hit — code was valid within the last 5 minutes.
  if (await isCacheValid(actorId)) return;

  // No code provided and cache is cold.
  if (!totpCode) {
    throw Object.assign(new Error("mfa_required"), { code: "mfa_required" as const });
  }

  const result = await verifyStepUp(totpCode);
  if (!result.ok) {
    throw Object.assign(new Error("mfa_required"), { code: "mfa_required" as const });
  }

  await setCache(actorId);
}
