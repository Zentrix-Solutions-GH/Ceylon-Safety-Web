import { imageSize } from "image-size";

/**
 * Reads pixel dimensions from an image buffer.
 * Returns null if the buffer is too short or the type is unrecognised.
 */
export function readDimensions(
  bytes: Uint8Array
): { width: number; height: number } | null {
  try {
    const result = imageSize(Buffer.from(bytes));
    if (!result.width || !result.height) return null;
    return { width: result.width, height: result.height };
  } catch {
    return null;
  }
}
