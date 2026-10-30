import "server-only";
import { timingSafeEqual } from "node:crypto";
import { healthchecksConfig } from "../config";
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

// Pings the Healthchecks heartbeat for the given job.
// URLs come from lib/config.ts healthchecksConfig(); missing config is skipped
// silently so staging runs without Healthchecks set up.
export async function pingHeartbeat(
  job: string,
  outcome: "success" | "fail"
): Promise<void> {
  const cfg = healthchecksConfig(job);
  if (!cfg) return;

  const suffix = outcome === "fail" ? "/fail" : "";
  const url = `${cfg.baseUrl}/${cfg.checkId}${suffix}`;

  try {
    await fetch(url, { method: "GET" });
  } catch {
    // Heartbeat failure must not crash the job response
  }
}
