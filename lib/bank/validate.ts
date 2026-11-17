import "server-only";

import type { ActionResult } from "@/types/api";

// Allowed MIME types for bank slip uploads (S-083, Assumptions: JPEG, PNG, PDF).
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "application/pdf"]);

// Magic byte signatures for real content-type detection (AC2, EC1).
function matchMagic(bytes: Uint8Array): string | null {
  if (bytes.length < 4) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e &&
    bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a &&
    bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return "image/png";
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return "application/pdf";
  return null;
}

/** Detect MIME type from magic bytes. Returns null for unrecognised content. */
export function detectMimeType(bytes: Uint8Array): string | null {
  return matchMagic(bytes);
}

export interface ValidatedFile {
  mimeType: string;
  sizeBytes: number;
  bytes: Uint8Array;
}

/** Validate a slip file: real content-type check, size limit. AC2, EC1, EC2. */
export async function validateSlipFile(
  file: File,
  maxBytes: number,
): Promise<ActionResult<ValidatedFile>> {
  if (file.size === 0) return { ok: false, code: "slip_invalid" };
  if (file.size > maxBytes) return { ok: false, code: "slip_invalid" };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const realMime = detectMimeType(bytes);
  if (!realMime || !ALLOWED_MIME_TYPES.has(realMime)) {
    return { ok: false, code: "slip_invalid" };
  }

  return { ok: true, data: { mimeType: realMime, sizeBytes: file.size, bytes } };
}
