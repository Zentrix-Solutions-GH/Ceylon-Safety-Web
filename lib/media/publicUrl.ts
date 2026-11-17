import { publicConfig } from "@/lib/config.public";

/**
 * Builds the public CDN URL for a media asset key.
 * Base URL comes from NEXT_PUBLIC_PUBLIC_MEDIA_BASE_URL in config.
 * The key is never embedded directly — the helper is the single point of truth (AC10).
 * Uses config.public so this helper is safe in both server and client components.
 */
export function publicUrl(key: string): string {
  if (!publicConfig.mediaCdnUrl) {
    throw new Error("NEXT_PUBLIC_PUBLIC_MEDIA_BASE_URL is not configured");
  }
  const base = publicConfig.mediaCdnUrl.replace(/\/$/, "");
  return `${base}/${key}`;
}
