// S-033 defines this interface; S-007 provides the real Upstash implementation.
// ASSUMED coarse limit: 60 req/min/IP. Keys are scoped (e.g. "api:<ip>").
// EC7: IP-keyed limits are treated as unreliable until S-002 confirms the header name.

export interface RateLimitResult {
  limited: boolean;
  retryAfterSeconds?: number;
}

/**
 * Check a named rate limit for the given key.
 * Stub: always allows. S-007 replaces this with the Upstash implementation.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function checkRateLimit(_key: string): Promise<RateLimitResult> {
  return { limited: false };
}
