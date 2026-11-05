import { r2Config } from "@/lib/config";

/**
 * Builds the public CDN URL for a media asset key.
 * Base URL comes from NEXT_PUBLIC_PUBLIC_MEDIA_BASE_URL in config.
 * The key is never embedded directly — the helper is the single point of truth (AC10).
 */
export function publicUrl(key: string): string {
  const cfg = r2Config();
  if (!cfg) throw new Error("[media] NEXT_PUBLIC_PUBLIC_MEDIA_BASE_URL not configured");
  const base = cfg.publicMediaBaseUrl.replace(/\/$/, "");
  return `${base}/${key}`;
}
