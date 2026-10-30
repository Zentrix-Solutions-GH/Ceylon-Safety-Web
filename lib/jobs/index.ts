import "server-only";
import { timingSafeEqual } from "node:crypto";
import { testJob } from "./test";

export type JobHandler = () => Promise<{ ok: boolean }>;

export const JOB_REGISTRY: Record<string, JobHandler> = {
  test: testJob,
};

// Constant-time string comparison — prevents timing side-channel on the secret.
// Pads both sides to the same length before comparing so a short input does not
// short-circuit early.
export function timingSafeStringEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const bufA = enc.encode(a);
  const bufB = enc.encode(b);

  // Pad to the same length so timingSafeEqual doesn't throw
  const len = Math.max(bufA.length, bufB.length);
  const paddedA = new Uint8Array(len);
  const paddedB = new Uint8Array(len);
  paddedA.set(bufA);
  paddedB.set(bufB);

  // Use bitwise & (not &&) so both sides always evaluate — prevents timing
  // side-channel from short-circuit evaluation revealing correct secret length.
  const lengthOk = a.length === b.length ? 1 : 0;
  const contentsOk = timingSafeEqual(paddedA, paddedB) ? 1 : 0;
  return (lengthOk & contentsOk) === 1;
}

// Job-specific heartbeat check IDs in env:  HEALTHCHECKS_<JOB_UPPER>_ID
// e.g. HEALTHCHECKS_TEST_ID for the "test" job.
// Base URL: HEALTHCHECKS_BASE_URL (e.g. "https://hc-ping.com")
// If either is absent, the ping is skipped silently outside production.
export async function pingHeartbeat(
  job: string,
  outcome: "success" | "fail"
): Promise<void> {
  const baseUrl = process.env["HEALTHCHECKS_BASE_URL"];
  const idKey = `HEALTHCHECKS_${job.toUpperCase().replace(/-/g, "_")}_ID`;
  const checkId = process.env[idKey];

  if (!baseUrl || !checkId) {
    // Missing URL — skip silently outside production
    return;
  }

  const suffix = outcome === "fail" ? "/fail" : "";
  const url = `${baseUrl}/${checkId}${suffix}`;

  try {
    await fetch(url, { method: "GET" });
  } catch {
    // Heartbeat failure must not crash the job response
  }
}
