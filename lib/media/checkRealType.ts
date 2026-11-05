import type { AllowedImageMime } from "@/types/media";

// Magic byte signatures for allowed image types.
// JPEG: FF D8 FF
// PNG:  89 50 4E 47 0D 0A 1A 0A
// WebP: 52 49 46 46 ?? ?? ?? ?? 57 45 42 50
const JPEG_SIG = [0xff, 0xd8, 0xff];
const PNG_SIG  = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const RIFF_SIG = [0x52, 0x49, 0x46, 0x46]; // "RIFF"
const WEBP_SIG = [0x57, 0x45, 0x42, 0x50]; // "WEBP" at offset 8

function startsWith(buf: Uint8Array, sig: number[], offset = 0): boolean {
  if (buf.length < offset + sig.length) return false;
  return sig.every((b, i) => buf[offset + i] === b);
}

/**
 * Detects the real MIME type of an image from its first bytes.
 * Returns null if the bytes do not match any allowed type (AC4, EC-E).
 * A zero-length buffer returns null.
 */
export function checkRealType(bytes: Uint8Array): AllowedImageMime | null {
  if (bytes.length === 0) return null;
  if (startsWith(bytes, JPEG_SIG)) return "image/jpeg";
  if (startsWith(bytes, PNG_SIG))  return "image/png";
  if (startsWith(bytes, RIFF_SIG) && startsWith(bytes, WEBP_SIG, 8)) return "image/webp";
  return null;
}
