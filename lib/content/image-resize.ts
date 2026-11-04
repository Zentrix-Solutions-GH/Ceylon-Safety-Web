// Browser-only image resize helper (AC11).
// No imports from server modules — this file is intentionally pure (no secrets, no DB).
// Called by the editor upload hook before getImageUploadLink (S-055).

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
type AllowedType = (typeof ALLOWED_TYPES)[number];

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB (AC11, EC6)
const MAX_PIXELS = 6000;                // 6000 px in either dimension (AC11, EC6)
const TARGET_WIDTHS = [480, 1200];      // Design widths (content design 14.1, N6c)
const WEBP_QUALITY = 0.85;

export type ResizedVariant = {
  blob: Blob;
  width: number;
  height: number;
  mimeType: AllowedType;
};

/**
 * Resizes a File to WebP copies at the target widths and returns them.
 * Never returns the full-size original (AC11).
 * Falls back to JPEG when the browser cannot produce WebP (EC5).
 * Throws on type, size, or dimension violations.
 */
export async function resizeImage(file: File): Promise<ResizedVariant[]> {
  // Type check (AC11)
  if (!(ALLOWED_TYPES as readonly string[]).includes(file.type)) {
    throw new Error(`Unsupported file type: ${file.type}`);
  }

  // Size check (AC11)
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`File exceeds 5 MB limit (${file.size} bytes)`);
  }

  // Decode and check pixel dimensions (EC6)
  const bitmap = await createImageBitmap(file);
  const origWidth = bitmap.width;
  const origHeight = bitmap.height;

  if (origWidth > MAX_PIXELS || origHeight > MAX_PIXELS) {
    bitmap.close();
    throw new Error(
      `Image dimensions ${origWidth}×${origHeight} exceed the 6000 px limit`
    );
  }

  // Determine which widths to produce (never enlarge, never return original)
  const widthsToProduce = TARGET_WIDTHS.filter((w) => w < origWidth);
  // If the image is narrower than the smallest target, produce one copy at original width
  if (widthsToProduce.length === 0) {
    widthsToProduce.push(origWidth);
  }

  const results: ResizedVariant[] = [];

  for (const targetW of widthsToProduce) {
    const scale = targetW / origWidth;
    const targetH = Math.round(origHeight * scale);

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);

    const blob = await _toBlob(canvas, "image/webp", WEBP_QUALITY);
    if (!blob) throw new Error("Canvas toBlob returned null");

    // Determine actual MIME — older browsers may return JPEG silently (EC5)
    const actualType =
      blob.type === "image/webp" || blob.type === "image/jpeg" || blob.type === "image/png"
        ? (blob.type as AllowedType)
        : "image/jpeg"; // safe fallback

    results.push({ blob, width: targetW, height: targetH, mimeType: actualType });
  }

  bitmap.close();
  return results;
}

function _toBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), type, quality);
  });
}
